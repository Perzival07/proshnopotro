/**
 * Chapter lists a tutor can load into the syllabus page as a starting point.
 *
 * These follow the NCERT textbooks in their 2023-24 rationalised editions.
 * NCERT has been bringing out new books under the 2023 curriculum framework,
 * so every list is loaded as ordinary, editable chapters: check them against
 * the books you teach from. CISCE (ICSE / ISC) lists are not included; paste
 * them in from the council's syllabus instead.
 */

export const BOARDS = ["CBSE", "ICSE", "ISC", "State board", "Other"] as const;
export type Board = (typeof BOARDS)[number];

export const CLASS_LEVELS = ["6", "7", "8", "9", "10", "11", "12"] as const;

type Presets = Record<string, Record<string, string[]>>;

/** NCERT chapters: class -> subject -> chapters in book order. */
export const NCERT_CHAPTERS: Presets = {
  "9": {
    Science: [
      "Matter in Our Surroundings",
      "Is Matter Around Us Pure?",
      "Atoms and Molecules",
      "Structure of the Atom",
      "The Fundamental Unit of Life",
      "Tissues",
      "Motion",
      "Force and Laws of Motion",
      "Gravitation",
      "Work and Energy",
      "Sound",
      "Improvement in Food Resources",
    ],
    Mathematics: [
      "Number Systems",
      "Polynomials",
      "Coordinate Geometry",
      "Linear Equations in Two Variables",
      "Introduction to Euclid's Geometry",
      "Lines and Angles",
      "Triangles",
      "Quadrilaterals",
      "Circles",
      "Heron's Formula",
      "Surface Areas and Volumes",
      "Statistics",
    ],
  },
  "10": {
    Science: [
      "Chemical Reactions and Equations",
      "Acids, Bases and Salts",
      "Metals and Non-metals",
      "Carbon and its Compounds",
      "Life Processes",
      "Control and Coordination",
      "How do Organisms Reproduce?",
      "Heredity",
      "Light – Reflection and Refraction",
      "The Human Eye and the Colourful World",
      "Electricity",
      "Magnetic Effects of Electric Current",
      "Our Environment",
    ],
    Mathematics: [
      "Real Numbers",
      "Polynomials",
      "Pair of Linear Equations in Two Variables",
      "Quadratic Equations",
      "Arithmetic Progressions",
      "Triangles",
      "Coordinate Geometry",
      "Introduction to Trigonometry",
      "Some Applications of Trigonometry",
      "Circles",
      "Areas Related to Circles",
      "Surface Areas and Volumes",
      "Statistics",
      "Probability",
    ],
  },
  "11": {
    Physics: [
      "Units and Measurements",
      "Motion in a Straight Line",
      "Motion in a Plane",
      "Laws of Motion",
      "Work, Energy and Power",
      "System of Particles and Rotational Motion",
      "Gravitation",
      "Mechanical Properties of Solids",
      "Mechanical Properties of Fluids",
      "Thermal Properties of Matter",
      "Thermodynamics",
      "Kinetic Theory",
      "Oscillations",
      "Waves",
    ],
    Chemistry: [
      "Some Basic Concepts of Chemistry",
      "Structure of Atom",
      "Classification of Elements and Periodicity in Properties",
      "Chemical Bonding and Molecular Structure",
      "Thermodynamics",
      "Equilibrium",
      "Redox Reactions",
      "Organic Chemistry – Some Basic Principles and Techniques",
      "Hydrocarbons",
    ],
    Mathematics: [
      "Sets",
      "Relations and Functions",
      "Trigonometric Functions",
      "Complex Numbers and Quadratic Equations",
      "Linear Inequalities",
      "Permutations and Combinations",
      "Binomial Theorem",
      "Sequences and Series",
      "Straight Lines",
      "Conic Sections",
      "Introduction to Three Dimensional Geometry",
      "Limits and Derivatives",
      "Statistics",
      "Probability",
    ],
    Biology: [
      "The Living World",
      "Biological Classification",
      "Plant Kingdom",
      "Animal Kingdom",
      "Morphology of Flowering Plants",
      "Anatomy of Flowering Plants",
      "Structural Organisation in Animals",
      "Cell: The Unit of Life",
      "Biomolecules",
      "Cell Cycle and Cell Division",
      "Photosynthesis in Higher Plants",
      "Respiration in Plants",
      "Plant Growth and Development",
      "Breathing and Exchange of Gases",
      "Body Fluids and Circulation",
      "Excretory Products and their Elimination",
      "Locomotion and Movement",
      "Neural Control and Coordination",
      "Chemical Coordination and Integration",
    ],
  },
  "12": {
    Physics: [
      "Electric Charges and Fields",
      "Electrostatic Potential and Capacitance",
      "Current Electricity",
      "Moving Charges and Magnetism",
      "Magnetism and Matter",
      "Electromagnetic Induction",
      "Alternating Current",
      "Electromagnetic Waves",
      "Ray Optics and Optical Instruments",
      "Wave Optics",
      "Dual Nature of Radiation and Matter",
      "Atoms",
      "Nuclei",
      "Semiconductor Electronics: Materials, Devices and Simple Circuits",
    ],
    Chemistry: [
      "Solutions",
      "Electrochemistry",
      "Chemical Kinetics",
      "The d- and f-Block Elements",
      "Coordination Compounds",
      "Haloalkanes and Haloarenes",
      "Alcohols, Phenols and Ethers",
      "Aldehydes, Ketones and Carboxylic Acids",
      "Amines",
      "Biomolecules",
    ],
    Mathematics: [
      "Relations and Functions",
      "Inverse Trigonometric Functions",
      "Matrices",
      "Determinants",
      "Continuity and Differentiability",
      "Application of Derivatives",
      "Integrals",
      "Application of Integrals",
      "Differential Equations",
      "Vector Algebra",
      "Three Dimensional Geometry",
      "Linear Programming",
      "Probability",
    ],
    Biology: [
      "Sexual Reproduction in Flowering Plants",
      "Human Reproduction",
      "Reproductive Health",
      "Principles of Inheritance and Variation",
      "Molecular Basis of Inheritance",
      "Evolution",
      "Human Health and Disease",
      "Microbes in Human Welfare",
      "Biotechnology: Principles and Processes",
      "Biotechnology and its Applications",
      "Organisms and Populations",
      "Ecosystem",
      "Biodiversity and Conservation",
    ],
  },
};

/** The NCERT chapters for a class and subject, if there is a preset. */
export function ncertPreset(classLevel: string, subject: string): string[] | null {
  const bySubject = NCERT_CHAPTERS[classLevel];
  if (!bySubject) return null;
  // "Maths" and "Mathematics", "General Science" and "Science" are the same book.
  const aliases: Record<string, string> = { maths: "Mathematics", "general science": "Science" };
  const key = aliases[subject.trim().toLowerCase()] ?? subject.trim();
  const match = Object.keys(bySubject).find((s) => s.toLowerCase() === key.toLowerCase());
  return match ? bySubject[match] : null;
}

/**
 * A chapter list pasted as text, one per line. Numbering, bullets and
 * "Chapter 3:" prefixes are dropped, as are blank lines and repeats.
 */
export function parseChapterList(text: string): string[] {
  const seen = new Set<string>();
  const out: string[] = [];
  for (const raw of text.split(/\r?\n/)) {
    const name = raw
      .trim()
      .replace(/^(?:chapter|ch\.?|unit)\s*\d+\s*[:.)-]?\s*/i, "")
      .replace(/^[-*•]\s*/, "")
      .replace(/^\(?\d{1,3}[.):]\s*/, "")
      .replace(/\s+/g, " ")
      .trim();
    if (!name || name.length > 150) continue;
    const key = name.toLowerCase();
    if (seen.has(key)) continue;
    seen.add(key);
    out.push(name);
  }
  return out;
}

/** Normalises a chapter name for matching: case, spacing and dashes. */
export function chapterKey(name: string): string {
  return name
    .toLowerCase()
    .replace(/[–—-]/g, "-")
    .replace(/[^a-z0-9ऀ-ॿ-]+/g, " ")
    .trim();
}

/**
 * Finds the chapter a tutor named in a paste: by name (ignoring case and
 * punctuation) or by its number in the list ("4", "Ch 4", "Chapter 4").
 */
export function findChapter<T extends { name: string }>(chapters: T[], written: string): T | null {
  const w = written.trim();
  const byNumber = w.match(/^(?:chapter|ch\.?)?\s*(\d{1,2})$/i);
  if (byNumber) return chapters[Number(byNumber[1]) - 1] ?? null;
  const key = chapterKey(w);
  return chapters.find((c) => chapterKey(c.name) === key) ?? null;
}
