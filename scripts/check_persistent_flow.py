"""Exercise a persistent session through the real BFF, including an API restart."""
import argparse
import json
import os
import signal
import socket
import subprocess
import sys
import time
import uuid
from uuid import uuid4

import httpx
import psycopg

from sonder_api.devseed import source_sha256
from sonder_api.stored_evidence import stored_evidence, verify_session


class FlowFailure(Exception):
    pass


def main(argv=None):
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument('--ui', default='http://localhost:3000')
    parser.add_argument('--api-port', type=int, default=8000)
    parser.add_argument('--release', required=True)
    parser.add_argument('--assignment', required=True, help='Open REPEAT assignment of a class the harness student is in')
    args = parser.parse_args(argv)
    try:
        uuid.UUID(args.assignment)
    except ValueError:
        print('--assignment must be the UUID of an open repeat assignment.', file=sys.stderr)
        return 2
    db_url = os.environ.get('SONDER_DATABASE_URL', '')
    token = os.environ.get('SONDER_ENGINE_TOKEN', '')
    cookie = os.environ.get('SONDER_HARNESS_COOKIE', '')
    other_cookie = os.environ.get('SONDER_HARNESS_OTHER_COOKIE', '')
    if not db_url or len(token) < 32 or not cookie:
        print('Set SONDER_DATABASE_URL, SONDER_ENGINE_TOKEN and SONDER_HARNESS_COOKIE.', file=sys.stderr)
        return 2
    record = {'transport': 'real Next BFF + FastAPI over HTTP; not browser automation', 'release': args.release,
              'engine_release': None, 'session_id': None, 'items': [], 'restart': 'not run', 'checks': [], 'failures': []}
    process = None
    base = f'http://127.0.0.1:{args.api_port}'
    headers = {'Cookie': cookie, 'Origin': args.ui}
    api_headers = {'X-Sonder-Token': token}
    def require(condition, label):
        if not condition:
            raise FlowFailure(label)
        record['checks'].append(label)
    def start():
        nonlocal process
        process = subprocess.Popen([sys.executable, '-m', 'sonder_api', '--store', 'postgres', '--release', args.release,
                                    '--port', str(args.api_port)], stdout=subprocess.DEVNULL, stderr=subprocess.DEVNULL)
        deadline = time.monotonic() + 30
        while time.monotonic() < deadline:
            if process.poll() is not None:
                raise FlowFailure('API exited before becoming healthy')
            try:
                r = httpx.get(base + '/engine/health', headers=api_headers, timeout=1)
                if r.status_code == 200:
                    record['engine_release'] = r.json().get('engine_release')
                    return
            except httpx.HTTPError:
                pass
            time.sleep(0.2)
        raise FlowFailure('API health timed out')
    def stop():
        nonlocal process
        if process is not None:
            if process.poll() is None:
                process.kill()
            process.wait(timeout=10)
            process = None
    def snapshot(response, name):
        require(response.status_code == 200, name + ': HTTP 200')
        data = response.json()
        safe = set(data) == {'contract_version', 'session_id', 'unit', 'question_budget', 'answered_count', 'status', 'question'}
        encoded = json.dumps(data)
        require(safe and 'MATH-' not in encoded and 'outcome' not in encoded and 'posterior' not in encoded, name + ': student-safe fields')
        return data
    def req(method, path, *, body=None, cookie_value=None):
        return httpx.request(method, args.ui.rstrip('/') + path, headers={**headers, 'Cookie': cookie_value or cookie}, json=body, timeout=30)
    try:
        with socket.socket() as sock:
            if sock.connect_ex(('127.0.0.1', args.api_port)) == 0:
                raise FlowFailure('API port is already in use; stop the existing API first')
        start()
        units = req('GET', '/api/diagnostic/units')
        require(units.status_code == 200 and any(u.get('unit_id') == 'U1' for u in units.json().get('units', [])), 'U1 available')
        listing = req('GET', '/api/diagnostic/sessions?unit_id=U1')
        require(listing.status_code == 200, 'unfinished lookup available')
        previous = listing.json().get('sessions', [])
        if previous:
            print('Unfinished session: ' + str(previous[0].get('session_id')) + '; finish or abandon it in the browser first.', file=sys.stderr)
            return 2
        payload = {'unit_id': 'U1', 'create_request_id': str(uuid4()), 'assignment_id': args.assignment}
        first = snapshot(req('POST', '/api/diagnostic/sessions', body=payload), 'start')
        sid = first['session_id']; record['session_id'] = sid
        require(snapshot(req('POST', '/api/diagnostic/sessions', body=payload), 'start retry') == first, 'identical start retry')
        path = f'/api/diagnostic/sessions/{sid}'
        value = first
        for index, option in enumerate('DBBA'):
            q = value['question']; record['items'].append(q['item_id'])
            answer = {'step_index': q['step_index'], 'item_id': q['item_id'], 'option_id': option}
            value = snapshot(req('POST', path + '/answers', body=answer), f'answer {index}')
            if index == 0:
                require(snapshot(req('POST', path + '/answers', body=answer), 'answer retry') == value, 'identical answer retry')
                require(snapshot(req('GET', path), 'refresh') == value, 'refresh preserves state')
                stop(); start()
                require(snapshot(req('GET', path), 'restart read') == value, 'restart preserves state')
                record['restart'] = 'passed'
        require(record['items'] == ['T1-005', 'T1-006', 'T1-007', 'T1-009'], 'D1 item sequence')
        require(value['status'] == 'complete', 'neutral completion')
        require(snapshot(req('POST', path + '/answers', body=answer), 'final retry') == value, 'final retry')
        listing = req('GET', '/api/diagnostic/sessions?unit_id=U1')
        require(listing.status_code == 200 and not listing.json().get('sessions'), 'no unfinished run after completion')
        require(req('GET', path + '/trace').status_code == 404, 'student trace unavailable')
        if other_cookie:
            require(req('GET', path, cookie_value=other_cookie).status_code == 404, 'other student denied')
        with psycopg.connect(db_url) as conn:
            ev = stored_evidence(conn, sid)
            require(ev is not None and ev['outcome']['outcome'] == 'diagnosed' and len(ev['steps']) == 4 and [x['item_id'] for x in ev['steps']] == record['items'], 'stored D1 evidence')
            require(verify_session(conn, sid) == [], 'stored evidence matches replay')
            row = conn.execute('SELECT c.pack_sha256 FROM sonder.diagnostic_session s JOIN sonder.response_model r ON r.id=s.response_model_id JOIN sonder.content_version c ON c.id=r.content_version_id WHERE s.id=%s', (sid,)).fetchone()
            record['pack_sha256'] = row[0]; record['source_sha256'] = source_sha256()
            if args.release == 'Maths_v2-U1-dev/spec-v2-prior':
                require(record['pack_sha256'] == record['source_sha256'], 'development source hash matches')
    except (FlowFailure, httpx.HTTPError, psycopg.Error, ValueError, KeyError, TypeError) as exc:
        # Never print request headers, response bodies, connection strings or cookies.
        record['failures'].append(str(exc) if isinstance(exc, FlowFailure) else type(exc).__name__)
    finally:
        stop()
        print(json.dumps(record, indent=2))
    return 1 if record['failures'] else 0


if __name__ == '__main__':
    raise SystemExit(main())
