"""Contract v2 conformance checks (I2-L01), runnable against a live engine service.

    SONDER_ENGINE_TOKEN=… python -m sonder_api.contract_check \
        --base-url http://127.0.0.1:8000 --actor <student A app_user.id> --actor <student B> --unit U1

Both actors must be able to start a session on the unit (in postgres mode: enrolled students).
Each run creates sessions. Exit 0 when every check passes; failures are listed.
"""
import argparse
import json
import os
from uuid import uuid4

import httpx


def run_checks(client: httpx.Client, token: str, actor_a: str, actor_b: str, unit_id: str) -> list[str]:
    failures = []

    def check(name, condition, expected, got):
        if not condition:
            failures.append(f"{name}: expected {expected}, got {got!r}")

    def call(method, path, *, actor=None, json=None, token=token):
        headers = {"X-Sonder-Token": token}
        if actor is not None:
            headers["X-Sonder-Actor"] = actor
        try:
            response = client.request(method, path, headers=headers, json=json)
            try:
                body = response.json()
            except ValueError:
                body = None
            return response.status_code, body, response.headers
        except httpx.HTTPError as exc:
            failures.append(f"{method} {path}: expected response, got {type(exc).__name__}")
            return 0, None, {}

    def error(name, result, status, code):
        check(name, result[:2] == (status, {"error": {"code": code}}), (status, code), result[:2])

    status, health, headers = call('GET', '/engine/health')
    check('health', status == 200 and isinstance(health, dict) and set(health) == {'contract_version', 'mode', 'ready', 'release', 'engine_release'} and health.get('contract_version') == 2 and health.get('ready') is True and headers.get('cache-control') == 'no-store', 'version 2 ready health and no-store', (status, health))
    error('bad token', call('GET', '/engine/health', token='bad'), 401, 'internal_unauthorized')
    status, units, _ = call('GET', '/engine/units')
    check('units', status == 200 and isinstance(units, dict) and units.get('contract_version') == 2 and any(u.get('unit_id') == unit_id for u in units.get('units', [])), 'unit in version 2 catalogue', (status, units))
    request = {'unit_id': unit_id, 'create_request_id': str(uuid4())}
    status, first, _ = call('POST', '/engine/sessions', actor=actor_a, json=request)
    valid = status == 200 and isinstance(first, dict) and set(first) == {'contract_version', 'session_id', 'unit', 'question_budget', 'answered_count', 'status', 'question'} and first.get('contract_version') == 2 and first.get('status') == 'in_progress' and first.get('answered_count') == 0 and isinstance(first.get('question'), dict) and first['question'].get('step_index') == 0 and [o.get('option_id') for o in first['question'].get('options', [])] == list('ABCD') and 'MATH-' not in json.dumps(first)
    check('start', valid, 'student-safe initial snapshot', (status, first))
    if not valid:
        return failures
    sid = first['session_id']
    path = f'/engine/sessions/{sid}'
    check('start retry', call('POST', '/engine/sessions', actor=actor_a, json=request)[:2] == (200, first), 'original snapshot', 'different response')
    error('start conflict', call('POST', '/engine/sessions', actor=actor_a, json={**request, 'unit_id': 'UX-unknown'}), 409, 'create_conflict')
    error('missing actor', call('POST', '/engine/sessions', json=request), 404, 'session_unavailable')
    error('extra field', call('POST', '/engine/sessions', actor=actor_a, json={**request, 'budget': 3}), 422, 'invalid_request')
    check('current', call('GET', path, actor=actor_a)[:2] == (200, first), 'initial snapshot', 'different response')
    error('other actor', call('GET', path, actor=actor_b), 404, 'session_unavailable')
    check('malformed id', call('GET', '/engine/sessions/guessed', actor=actor_a)[0] == 404, 404, 'different status')
    for actor, present in ((actor_a, True), (actor_b, False)):
        code, body, _ = call('GET', '/engine/sessions?status=in_progress', actor=actor)
        rows = body.get('sessions', []) if isinstance(body, dict) else []
        found = any(row.get('session_id') == sid and row.get('answered_count') == 0 for row in rows)
        check('in-progress list', code == 200 and found == present, present, found)
    check('bad status', call('GET', '/engine/sessions?status=bogus', actor=actor_a)[0] == 422, 422, 'different status')
    question = first['question']
    payload = {'step_index': 0, 'item_id': question['item_id'], 'option_id': 'A'}
    code, current, _ = call('POST', path + '/answers', actor=actor_a, json=payload)
    check('answer', code == 200 and isinstance(current, dict) and current.get('answered_count') == 1, 'one answer', (code, current))
    if code != 200 or not isinstance(current, dict):
        return failures
    check('answer retry', call('POST', path + '/answers', actor=actor_a, json=payload)[:2] == (200, current), 'original transition', 'different response')
    error('answer conflict', call('POST', path + '/answers', actor=actor_a, json={**payload, 'option_id': 'B'}), 409, 'answer_conflict')
    if current.get('status') != 'complete':
        q = current['question']
        error('step conflict', call('POST', path + '/answers', actor=actor_a, json={'step_index': 5, 'item_id': q['item_id'], 'option_id': 'A'}), 409, 'step_conflict')
        error('item conflict', call('POST', path + '/answers', actor=actor_a, json={'step_index': 1, 'item_id': 'T0-000', 'option_id': 'A'}), 409, 'item_conflict')
        check('strict step', call('POST', path + '/answers', actor=actor_a, json={'step_index': '1', 'item_id': q['item_id'], 'option_id': 'A'})[0] == 422, 422, 'different status')
    for _ in range(1001):
        if current.get('status') == 'complete':
            break
        q = current.get('question')
        if not isinstance(q, dict):
            check('pending question', False, 'question object', q)
            return failures
        payload = {'step_index': q['step_index'], 'item_id': q['item_id'], 'option_id': 'A'}
        code, current, _ = call('POST', path + '/answers', actor=actor_a, json=payload)
        if code != 200 or not isinstance(current, dict):
            check('completion answer', False, 200, (code, current))
            return failures
    check('completion', current.get('status') == 'complete' and current.get('question') is None, 'complete with no question', current)
    check('final retry', call('POST', path + '/answers', actor=actor_a, json=payload)[:2] == (200, current), 'final snapshot', 'different response')
    error('finished', call('POST', path + '/answers', actor=actor_a, json={**payload, 'step_index': current['answered_count']}), 409, 'session_finished')
    code, trace, _ = call('GET', path + '/trace')
    trace = trace.get('trace', {}) if isinstance(trace, dict) else {}
    check('trace', code == 200 and trace.get('outcome', {}).get('outcome') != 'in_progress' and len(trace.get('steps', [])) == current['answered_count'], 'finished trace with all steps', (code, trace))
    code, listing, _ = call('GET', '/engine/sessions?status=complete', actor=actor_a)
    check('complete list', code == 200 and isinstance(listing, dict) and any(row.get('session_id') == sid and row.get('status') == 'complete' for row in listing.get('sessions', [])), 'completed session', listing)
    return failures


def main(argv=None):
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument('--base-url', required=True)
    parser.add_argument('--actor', action='append', required=True)
    parser.add_argument('--unit', default='U1')
    args = parser.parse_args(argv)
    if len(args.actor) != 2:
        parser.error('exactly two --actor values are required')
    with httpx.Client(base_url=args.base_url, timeout=30) as client:
        failures = run_checks(client, os.environ.get('SONDER_ENGINE_TOKEN', ''), *args.actor, args.unit)
    print(json.dumps({'checks': 'contract v2', 'failures': failures}))
    return 1 if failures else 0


if __name__ == '__main__':
    raise SystemExit(main())
