import type { LearnPage } from "./types";

/**
 * Fully authored learning-hub pages (Feature 8a). Three misconceptions get
 * the full treatment; everything else in the catalogue shows a "coming
 * soon" stub on the index (`app/student/learn/page.tsx`).
 */
export const LEARN_PAGES: LearnPage[] = [
  {
    subject: "mathematics",
    code: "M4",
    title: "Rounding: which digit decides",
    whatItIs:
      "When rounding to a place value, it's easy to check the wrong digit — one place further along than the one that actually decides. On 27.48 to the nearest whole number, that means checking the 8 (hundredths) instead of the 4 (tenths), and getting 28 instead of 27.",
    howToThink:
      "Find the place you're rounding to, then look at exactly one digit — the one immediately to its right. If that digit is 5 or more, round up; otherwise leave it. Nothing further along matters.",
    example: {
      prompt: "Round 27.48 to the nearest whole number.",
      wrongMove: "Checking the hundredths digit (8) — one place too far right — and rounding up to 28.",
      rightMove: "Checking the tenths digit (4), the one immediately to the right of the units place, and leaving it as is.",
      answer: "27",
    },
    searchQuery: "which digit decides when rounding decimals",
    resources: [
      {
        title: "Rounding decimals: which digit decides",
        source: "YouTube",
        kind: "video",
        url: "https://www.youtube.com/results?search_query=rounding+decimals+which+digit+decides",
        rationale: "Walks through the same 'check one digit only' rule with several worked examples.",
        relevance: 0.93,
      },
      {
        title: "Rounding Numbers",
        source: "Math is Fun",
        kind: "article",
        url: "https://www.mathsisfun.com/rounding-numbers.html",
        rationale: "Short, plain-language reference with a clear diagram of which digit to check.",
        relevance: 0.87,
      },
      {
        title: "Rounding decimals — practice",
        source: "Khan Academy",
        kind: "interactive",
        url: "https://www.khanacademy.org/search?page_search_query=rounding+decimals",
        rationale: "Self-marking practice questions to check the rule sticks under pressure.",
        relevance: 0.81,
      },
    ],
    chat: {
      greeting:
        "Hi — I can talk through rounding decimals, the digit-check rule, and work through examples with you. What would help?",
      entries: [
        {
          id: "why",
          label: "Why does this mix-up happen?",
          question: "Why do people check the wrong digit when rounding?",
          answer:
            "Because the natural instinct is to look at 'the next digit along' rather than 'the digit right next to the rounding place'. On a number like 27.48, both the 4 and the 8 feel like 'the next digit' depending on which place you're already looking at — so it's easy to drift one place too far right.",
          followups: ["example"],
        },
        {
          id: "example",
          label: "Give me an example",
          question: "Can you give me an example?",
          answer:
            "Take 27.48, rounded to the nearest whole number. The place you're rounding to is the units (27). The digit immediately to its right is the tenths digit — 4. Since 4 is below 5, you leave it: 27.",
          example: {
            prompt: "Round 27.48 to the nearest whole number.",
            wrongMove: "Checking the hundredths digit (8) instead — one place too far right.",
            rightMove: "Checking the tenths digit (4), immediately to the right of the units place.",
            answer: "27",
          },
          followups: ["simpler", "harder"],
        },
        {
          id: "simpler",
          label: "Explain it simpler",
          question: "Explain it simpler",
          answer:
            "Cover up every digit except the one right next to where you're rounding. Look at just that one digit. 5 or more → round up. Less than 5 → leave it. Don't look any further than that one digit.",
        },
        {
          id: "harder",
          label: "Give me a harder example",
          question: "Give me a harder example",
          answer:
            "Try 6.2384 rounded to two decimal places. You're rounding to the hundredths, so the digit that decides is the thousandths — 8. Since 8 is 5 or more, the hundredths round up: 6.24. The digit after that (the 4 in the ten-thousandths place) never comes into it.",
          example: {
            prompt: "Round 6.2384 to two decimal places.",
            wrongMove: "Checking the ten-thousandths digit (4) instead of the thousandths digit (8).",
            rightMove: "Checking the thousandths digit (8), immediately to the right of the hundredths place.",
            answer: "6.24",
          },
        },
      ],
      fallback:
        "I can walk through this concept — try one of the questions above, or ask for a simpler explanation or a harder example.",
    },
  },
  {
    subject: "physics",
    code: "M1",
    title: "Kinetic energy: why it's squared",
    whatItIs:
      "It's tempting to treat kinetic energy as directly proportional to speed — double the speed, double the energy — using ½·m·v. The real relationship is ½·m·v², so doubling the speed actually quadruples the energy.",
    howToThink:
      "Kinetic energy comes from the work needed to accelerate an object from rest, and that work scales with the square of the final speed, not the speed itself. Always square the speed before multiplying by ½·m.",
    example: {
      prompt: "A 2 kg object moves at 3 m/s. Then its speed doubles to 6 m/s. How does the kinetic energy change?",
      wrongMove: "Using ½·m·v: energy doubles from 3 J to 6 J because the speed doubled.",
      rightMove: "Using ½·m·v²: energy goes from ½·2·3² = 9 J to ½·2·6² = 36 J — four times as much, not two.",
      answer: "The energy quadruples, it doesn't double.",
    },
    searchQuery: "why is kinetic energy proportional to speed squared",
    resources: [
      {
        title: "Kinetic Energy",
        source: "The Physics Classroom",
        kind: "article",
        url: "https://www.physicsclassroom.com/class/energy/Lesson-1/Kinetic-Energy",
        rationale: "Derives ½·m·v² from the work-energy relationship, which is exactly where the square comes from.",
        relevance: 0.91,
      },
      {
        title: "Why kinetic energy has a v², not just v",
        source: "YouTube",
        kind: "video",
        url: "https://www.youtube.com/results?search_query=why+is+kinetic+energy+v+squared",
        rationale: "Visual worked examples comparing doubling speed vs. quadrupling energy.",
        relevance: 0.86,
      },
      {
        title: "Kinetic energy — practice",
        source: "Khan Academy",
        kind: "interactive",
        url: "https://www.khanacademy.org/search?page_search_query=kinetic+energy",
        rationale: "Practice problems that specifically vary speed to test the squared relationship.",
        relevance: 0.78,
      },
    ],
    chat: {
      greeting:
        "Hi — ask me about kinetic energy, why the speed is squared, or work through an example together.",
      entries: [
        {
          id: "why",
          label: "Why is it squared?",
          question: "Why is kinetic energy proportional to speed squared, not just speed?",
          answer:
            "Kinetic energy equals the work done to bring an object up to speed. Work is force times distance, and for constant acceleration the distance covered grows with the square of the final speed — so the energy inherits that square. It's a consequence of the physics of acceleration, not an arbitrary rule.",
          followups: ["example"],
        },
        {
          id: "example",
          label: "Give me an example",
          question: "Can you give me an example?",
          answer:
            "A 2 kg object at 3 m/s has KE = ½ × 2 × 3² = 9 J. Double the speed to 6 m/s and KE = ½ × 2 × 6² = 36 J — four times as much, because 6² is four times 3².",
          example: {
            prompt: "A 2 kg object speeds up from 3 m/s to 6 m/s.",
            wrongMove: "Assuming the energy doubles because the speed doubled.",
            rightMove: "Squaring each speed first: 3² = 9, 6² = 36 — the energy quadruples.",
            answer: "36 J, four times the original 9 J.",
          },
          followups: ["simpler", "harder"],
        },
        {
          id: "simpler",
          label: "Explain it simpler",
          question: "Explain it simpler",
          answer:
            "Never multiply mass by speed alone. Always square the speed first, then multiply by ½ and the mass. Speed × speed, not speed × 2.",
        },
        {
          id: "harder",
          label: "Give me a harder example",
          question: "Give me a harder example",
          answer:
            "A 0.5 kg ball at 4 m/s has KE = ½ × 0.5 × 4² = 4 J. If its speed triples to 12 m/s, KE = ½ × 0.5 × 12² = 36 J — nine times as much, because 12² is nine times 4².",
          example: {
            prompt: "A 0.5 kg ball's speed triples from 4 m/s to 12 m/s.",
            wrongMove: "Assuming the energy triples because the speed tripled.",
            rightMove: "Squaring each speed: 4² = 16, 12² = 144 — nine times as much.",
            answer: "36 J, nine times the original 4 J.",
          },
        },
      ],
      fallback:
        "I can walk through this concept — try one of the questions above, or ask for a simpler explanation or a harder example.",
    },
  },
  {
    subject: "chemistry",
    code: "M2",
    title: "Mole ratios: reading the coefficients",
    whatItIs:
      "In a balanced equation, the numbers in front of each substance (the coefficients) give the ratio moles react and form in. It's easy to skip past them and assume every substance reacts in a 1:1 ratio, which only happens to be true when the coefficients are already equal.",
    howToThink:
      "Before doing any arithmetic, read the coefficients of the two substances you're relating and write down their ratio. Multiply or divide by that ratio — never assume 1:1 unless the coefficients actually say so.",
    example: {
      prompt: "N₂ + 3H₂ → 2NH₃. From 6 mol of H₂ with nitrogen in excess, how many moles of NH₃ form?",
      wrongMove: "Assuming a 1:1 ratio between H₂ and NH₃, giving 6 mol.",
      rightMove: "Reading the coefficients — 3 mol H₂ makes 2 mol NH₃ — and scaling: 6 × 2/3 = 4 mol.",
      answer: "4 mol",
    },
    searchQuery: "mole ratio balanced equation stoichiometry",
    resources: [
      {
        title: "Mole ratios and stoichiometry",
        source: "YouTube",
        kind: "video",
        url: "https://www.youtube.com/results?search_query=mole+ratio+balanced+equation+stoichiometry",
        rationale: "Steps through reading coefficients as a ratio before any arithmetic — the exact habit this misconception skips.",
        relevance: 0.9,
      },
      {
        title: "Stoichiometry",
        source: "Khan Academy",
        kind: "article",
        url: "https://www.khanacademy.org/search?page_search_query=mole+ratio+stoichiometry",
        rationale: "Covers reading a balanced equation as a mole ratio, with several worked conversions.",
        relevance: 0.85,
      },
      {
        title: "Stoichiometry — search results",
        source: "BBC",
        kind: "interactive",
        url: "https://www.bbc.co.uk/search?q=stoichiometry",
        rationale: "GCSE-level explainers and practice questions on reacting masses and mole ratios.",
        relevance: 0.76,
      },
    ],
    chat: {
      greeting:
        "Hi — ask me about mole ratios, reading balanced equations, or work through a stoichiometry example together.",
      entries: [
        {
          id: "why",
          label: "Why isn't it always 1:1?",
          question: "Why isn't the mole ratio always 1:1?",
          answer:
            "Because a balanced equation is telling you exactly how many of each particle react and form — and those numbers usually differ. N₂ + 3H₂ → 2NH₃ means 1 nitrogen molecule reacts with 3 hydrogen molecules to make 2 ammonia molecules. Treating it as 1:1 throws that ratio away.",
          followups: ["example"],
        },
        {
          id: "example",
          label: "Give me an example",
          question: "Can you give me an example?",
          answer:
            "N₂ + 3H₂ → 2NH₃. Starting from 6 mol of H₂, the ratio of H₂ to NH₃ is 3:2. So 6 mol H₂ makes 6 × 2/3 = 4 mol NH₃ — not 6 mol, which is what a 1:1 assumption would give.",
          example: {
            prompt: "N₂ + 3H₂ → 2NH₃. From 6 mol of H₂, how many moles of NH₃ form?",
            wrongMove: "Assuming a 1:1 ratio: 6 mol H₂ gives 6 mol NH₃.",
            rightMove: "Using the 3:2 ratio from the coefficients: 6 × 2/3 = 4 mol.",
            answer: "4 mol",
          },
          followups: ["simpler", "harder"],
        },
        {
          id: "simpler",
          label: "Explain it simpler",
          question: "Explain it simpler",
          answer:
            "Before you calculate anything, write the two coefficients you care about as a ratio — like '3 : 2'. Multiply by that ratio, not by 1.",
        },
        {
          id: "harder",
          label: "Give me a harder example",
          question: "Give me a harder example",
          answer:
            "2Al + 3Cl₂ → 2AlCl₃. From 9 mol of Cl₂ with aluminium in excess: the Cl₂-to-AlCl₃ ratio is 3:2, so 9 × 2/3 = 6 mol of AlCl₃ form. A 1:1 assumption would wrongly give 9 mol; inverting the ratio would wrongly give 13.5 mol.",
          example: {
            prompt: "2Al + 3Cl₂ → 2AlCl₃. From 9 mol of Cl₂, how many moles of AlCl₃ form?",
            wrongMove: "Assuming 1:1 (9 mol) or inverting the ratio (13.5 mol).",
            rightMove: "Using the 3:2 ratio from the coefficients: 9 × 2/3 = 6 mol.",
            answer: "6 mol",
          },
        },
      ],
      fallback:
        "I can walk through this concept — try one of the questions above, or ask for a simpler explanation or a harder example.",
    },
  },
];

export function getLearnPage(subject: string, code: string): LearnPage | undefined {
  return LEARN_PAGES.find((p) => p.subject === subject && p.code === code);
}

export function learnPageHref(subject: string, code: string): string | null {
  return getLearnPage(subject, code) ? `/student/learn/${subject}/${code}` : null;
}
