/**
 * The editorial layer of the library.
 *
 * Everything here is written by hand: the slug, the display title and author,
 * the shelf a book belongs on, and the one-line pitch. Everything else —
 * word counts, licence, canonical title, download URLs — is fetched and
 * verified by `scripts/build-library.mjs` and must never be typed in by hand.
 *
 * `pg` is a Project Gutenberg ebook number. Every one of these is a work whose
 * copyright has expired in the United States; Gutendex reports `copyright:
 * false` for each, and the build refuses to package anything that doesn't.
 *
 * `noCover` marks a book whose Gutenberg cover is not artwork at all but the
 * generated flat-colour placeholder with the Project Gutenberg wordmark stamped
 * across it. All fifty covers were looked at; these nine are filler, and the
 * app's own title-derived artwork is better than shipping someone's branding.
 */

/**
 * Shelves, in the order the library screen shows them.
 *
 * `short`, `sitting` and `long` are *derived* from each book's word count by
 * the build — never hand-assigned — so their promises stay true.
 */
export const SHELVES = [
  { id: 'featured', title: 'Start here', subtitle: 'Ten books that show what ReadingLoud does' },
  { id: 'short', title: 'Short reads', subtitle: 'A whole work in about an hour' },
  { id: 'sitting', title: 'One or two sittings' },
  { id: 'classics', title: 'Popular classics' },
  { id: 'mystery', title: 'Mystery & crime' },
  { id: 'romance', title: 'Romance' },
  { id: 'gothic', title: 'Dark & gothic' },
  { id: 'scifi', title: 'Science fiction' },
  { id: 'adventure', title: 'Adventure' },
  { id: 'fantasy', title: 'Fantasy & fable' },
  { id: 'stories', title: 'Short stories & plays' },
  { id: 'lives', title: 'Lives' },
  { id: 'ideas', title: 'Philosophy & ideas' },
  { id: 'world', title: 'Science, history & travel' },
  { id: 'long', title: 'The long haul', subtitle: 'Ten hours and up — for the whole commute, all month' },
];

export const BOOKS = [
  // ── Romance ───────────────────────────────────────────────────────────────
  {
    slug: 'pride-and-prejudice',
    // Not #1342: that edition opens with a five-page Saintsbury preface and no
    // chapter heading, so a listener hears literary criticism before Austen.
    // #42671 is the 1813 first-edition text, chapter headings intact.
    pg: 42671,
    noCover: true,
    title: 'Pride and Prejudice',
    author: 'Jane Austen',
    year: 1813,
    category: 'Romance',
    shelves: ['featured', 'classics', 'romance'],
    featured: true,
    description:
      'Elizabeth Bennet has judged Mr Darcy, and Mr Darcy has judged the Bennets. Austen spends four hundred pages proving both of them wrong, one perfectly balanced sentence at a time.',
  },
  {
    slug: 'persuasion',
    pg: 105,
    title: 'Persuasion',
    author: 'Jane Austen',
    year: 1817,
    category: 'Romance',
    shelves: ['romance', 'classics'],
    description:
      'Anne Elliot was talked out of the man she loved eight years ago. He has just walked back into the room. Austen’s last and quietest novel, and the one that aches.',
  },
  {
    slug: 'jane-eyre',
    pg: 1260,
    title: 'Jane Eyre',
    author: 'Charlotte Brontë',
    year: 1847,
    category: 'Romance',
    shelves: ['romance', 'gothic', 'classics'],
    description:
      'A plain, poor, friendless governess refuses, over and over, to be smaller than she is. The house she works in has a secret on the third floor.',
  },
  {
    slug: 'wuthering-heights',
    pg: 768,
    title: 'Wuthering Heights',
    author: 'Emily Brontë',
    year: 1847,
    category: 'Gothic',
    shelves: ['gothic', 'romance', 'classics'],
    description:
      'Not a love story so much as a haunting with two people in it. Heathcliff and Catherine tear two families apart across two generations of Yorkshire moorland.',
  },

  // ── Literary fiction ─────────────────────────────────────────────────────
  {
    slug: 'the-great-gatsby',
    pg: 64317,
    title: 'The Great Gatsby',
    author: 'F. Scott Fitzgerald',
    year: 1925,
    category: 'Literary Fiction',
    shelves: ['featured', 'classics'],
    featured: true,
    description:
      'A man throws enormous parties in the hope that one particular guest will wander in. The great American novel about wanting something you already lost.',
  },
  {
    slug: 'crime-and-punishment',
    pg: 2554,
    title: 'Crime and Punishment',
    author: 'Fyodor Dostoevsky',
    aka: { author: ['Dostoyevsky'] },
    year: 1866,
    category: 'Literary Fiction',
    shelves: ['classics'],
    description:
      'A destitute student in St Petersburg murders a pawnbroker to prove a theory about himself, then spends four hundred pages being interrogated by his own mind.',
  },
  {
    slug: 'moby-dick',
    pg: 2701,
    title: 'Moby-Dick',
    author: 'Herman Melville',
    year: 1851,
    category: 'Literary Fiction',
    shelves: ['classics', 'adventure'],
    description:
      'One captain, one whale, and several hundred pages of digression on rope, whiteness and God. Strange, funny, and far wilder than its reputation.',
  },
  {
    slug: 'heart-of-darkness',
    noCover: true,
    pg: 219,
    title: 'Heart of Darkness',
    author: 'Joseph Conrad',
    year: 1899,
    category: 'Literary Fiction',
    shelves: ['classics'],
    description:
      'A steamboat goes up the Congo to collect a man who has stopped pretending. Short, dense, and permanently unsettling.',
  },
  {
    slug: 'a-tale-of-two-cities',
    pg: 98,
    title: 'A Tale of Two Cities',
    author: 'Charles Dickens',
    year: 1859,
    category: 'Historical Fiction',
    shelves: ['classics'],
    description:
      'London and Paris, before and during the Terror. It has the most famous opening in English and an ending that earns every word of it.',
  },
  {
    slug: 'a-christmas-carol',
    pg: 46,
    title: 'A Christmas Carol',
    author: 'Charles Dickens',
    year: 1843,
    category: 'Literary Fiction',
    shelves: ['classics', 'stories'],
    description:
      'Three ghosts, one night, one thoroughly deserved fright. A novella built to be read aloud in an evening — Dickens toured it himself for years.',
  },

  // ── Mystery, crime, thriller ──────────────────────────────────────────────
  {
    slug: 'the-adventures-of-sherlock-holmes',
    pg: 1661,
    title: 'The Adventures of Sherlock Holmes',
    author: 'Arthur Conan Doyle',
    year: 1892,
    category: 'Mystery',
    shelves: ['featured', 'mystery', 'stories'],
    featured: true,
    description:
      'Twelve self-contained cases, each about forty minutes. The best possible way to test a reading app: finish one, and you have finished something.',
  },
  {
    slug: 'the-hound-of-the-baskervilles',
    pg: 2852,
    title: 'The Hound of the Baskervilles',
    author: 'Arthur Conan Doyle',
    year: 1902,
    category: 'Mystery',
    shelves: ['mystery', 'gothic'],
    description:
      'A family curse, a moor at night, and something very large leaving prints. Holmes is offstage for a third of it, which is exactly why it works.',
  },
  {
    slug: 'peter-pan',
    pg: 16,
    title: 'Peter Pan',
    author: 'J. M. Barrie',
    aka: { title: ['Peter and Wendy'] },
    year: 1911,
    category: 'Fantasy',
    shelves: ['fantasy'],
    description:
      'Barrie’s own novel of Neverland, narrated by an adult who keeps interrupting to say how sad all this is. Much stranger than the pantomime.',
  },
  {
    slug: 'the-mysterious-affair-at-styles',
    pg: 863,
    title: 'The Mysterious Affair at Styles',
    author: 'Agatha Christie',
    year: 1920,
    category: 'Mystery',
    shelves: ['mystery'],
    description:
      'Christie’s first novel and Poirot’s first appearance: a country house, a poisoning, and a little Belgian with an ego to match his moustache.',
  },
  {
    slug: 'the-thirty-nine-steps',
    pg: 558,
    title: 'The Thirty-Nine Steps',
    author: 'John Buchan',
    year: 1915,
    category: 'Thriller',
    shelves: ['mystery', 'adventure'],
    description:
      'A bored man in London finds a corpse in his flat and spends the next two hundred miles running. The template every chase thriller has copied since.',
  },

  // ── Gothic and horror ─────────────────────────────────────────────────────
  {
    slug: 'dracula',
    pg: 345,
    title: 'Dracula',
    author: 'Bram Stoker',
    year: 1897,
    category: 'Horror',
    shelves: ['featured', 'gothic'],
    featured: true,
    description:
      'Told entirely in letters, diaries and telegrams by people who do not yet know what they are describing. Reads aloud better than almost anything else here.',
  },
  {
    slug: 'frankenstein',
    pg: 84,
    title: 'Frankenstein',
    author: 'Mary Shelley',
    year: 1818,
    category: 'Gothic',
    shelves: ['gothic', 'scifi', 'classics'],
    description:
      'A student builds a man and then runs from him. Written at nineteen, and still the sharpest thing anyone has said about making something you cannot take back.',
  },
  {
    slug: 'the-picture-of-dorian-gray',
    pg: 174,
    title: 'The Picture of Dorian Gray',
    author: 'Oscar Wilde',
    year: 1890,
    category: 'Gothic',
    shelves: ['gothic', 'classics'],
    description:
      'A portrait ages so its subject need not. Wilde’s only novel, and the epigrams keep landing right up to the moment it turns genuinely nasty.',
  },
  {
    slug: 'the-strange-case-of-dr-jekyll-and-mr-hyde',
    pg: 43,
    title: 'The Strange Case of Dr Jekyll and Mr Hyde',
    author: 'Robert Louis Stevenson',
    year: 1886,
    category: 'Horror',
    shelves: ['gothic'],
    description:
      'Written as a mystery, not a reveal: a lawyer trying to work out why his respectable friend has left everything to a man nobody can describe.',
  },
  {
    slug: 'the-turn-of-the-screw',
    pg: 209,
    title: 'The Turn of the Screw',
    author: 'Henry James',
    year: 1898,
    category: 'Gothic',
    shelves: ['gothic', 'stories'],
    description:
      'A governess sees figures on the tower and the lake. Whether anyone else does is the argument the book has been starting for over a century.',
  },
  {
    slug: 'carmilla',
    pg: 10007,
    title: 'Carmilla',
    author: 'Sheridan Le Fanu',
    year: 1872,
    category: 'Horror',
    shelves: ['gothic'],
    description:
      'The vampire novella that came twenty-six years before Dracula, set in a lonely Styrian schloss where a guest arrives after a carriage accident.',
  },

  // ── Adventure ─────────────────────────────────────────────────────────────
  {
    slug: 'treasure-island',
    pg: 120,
    title: 'Treasure Island',
    author: 'Robert Louis Stevenson',
    year: 1883,
    category: 'Adventure',
    shelves: ['featured', 'adventure'],
    featured: true,
    description:
      'A map falls out of a dead sailor’s sea chest. Every pirate you have ever pictured — the black spot, the parrot, Long John Silver — starts here.',
  },
  {
    slug: 'the-call-of-the-wild',
    pg: 215,
    title: 'The Call of the Wild',
    author: 'Jack London',
    year: 1903,
    category: 'Adventure',
    shelves: ['adventure'],
    description:
      'A stolen dog is shipped north to the Klondike and unlearns, week by week, everything that made him a pet. Lean, brutal, and over in two hours.',
  },
  {
    slug: 'around-the-world-in-eighty-days',
    pg: 103,
    title: 'Around the World in Eighty Days',
    author: 'Jules Verne',
    year: 1873,
    category: 'Adventure',
    shelves: ['adventure'],
    description:
      'Phileas Fogg bets half his fortune that the planet can be circled on schedule, then refuses to look at any of it. A comedy about punctuality.',
  },
  {
    slug: 'the-count-of-monte-cristo',
    pg: 1184,
    title: 'The Count of Monte Cristo',
    author: 'Alexandre Dumas',
    year: 1844,
    category: 'Adventure',
    shelves: ['adventure'],
    description:
      'Wrongful imprisonment, a fortune, and revenge served across a thousand pages. The longest book in this library, and the fastest-moving.',
  },
  {
    slug: 'the-adventures-of-huckleberry-finn',
    pg: 76,
    title: 'Adventures of Huckleberry Finn',
    author: 'Mark Twain',
    year: 1884,
    category: 'Adventure',
    shelves: ['adventure', 'classics'],
    description:
      'A boy and a man escaping slavery float down the Mississippi on a raft. Twain wrote American speech onto the page and nobody has undone it since.',
  },

  // ── Science fiction ───────────────────────────────────────────────────────
  {
    slug: 'the-time-machine',
    pg: 35,
    title: 'The Time Machine',
    author: 'H. G. Wells',
    year: 1895,
    category: 'Science Fiction',
    shelves: ['featured', 'scifi'],
    featured: true,
    description:
      'A dinner-party guest returns filthy and hungry with a story about the year 802,701. Ninety minutes long, and it invented an entire genre.',
  },
  {
    slug: 'the-war-of-the-worlds',
    pg: 36,
    title: 'The War of the Worlds',
    author: 'H. G. Wells',
    year: 1898,
    category: 'Science Fiction',
    shelves: ['scifi'],
    description:
      'Cylinders land in Surrey and the greatest empire on earth is obsolete by Tuesday. Written as reportage, which is what still makes it frightening.',
  },
  {
    slug: 'flatland',
    pg: 97,
    title: 'Flatland',
    author: 'Edwin A. Abbott',
    year: 1884,
    category: 'Science Fiction',
    shelves: ['scifi', 'ideas'],
    description:
      'A square living in two dimensions is visited by a sphere. Part geometry lesson, part savage satire of Victorian class, and unlike anything else.',
  },

  // ── Fantasy ───────────────────────────────────────────────────────────────
  {
    slug: 'alices-adventures-in-wonderland',
    pg: 11,
    title: "Alice's Adventures in Wonderland",
    author: 'Lewis Carroll',
    year: 1865,
    category: 'Fantasy',
    shelves: ['fantasy'],
    description:
      'Down the rabbit hole, through a book that behaves like the logic problem it is. Two hours, and the jokes are aimed at adults more than you remember.',
  },
  {
    slug: 'the-wonderful-wizard-of-oz',
    pg: 55,
    title: 'The Wonderful Wizard of Oz',
    author: 'L. Frank Baum',
    year: 1900,
    category: 'Fantasy',
    shelves: ['fantasy'],
    description:
      'The book, not the film: no ruby slippers, a good deal more travelling, and a wizard whose fraud is stated plainly and forgiven anyway.',
  },

  // ── Short stories and plays ───────────────────────────────────────────────
  {
    slug: 'the-yellow-wallpaper',
    pg: 1952,
    title: 'The Yellow Wallpaper',
    author: 'Charlotte Perkins Gilman',
    year: 1892,
    category: 'Short Stories',
    shelves: ['featured', 'stories', 'gothic'],
    featured: true,
    description:
      'A woman is prescribed rest and forbidden to write, so she writes anyway, about the wallpaper. Half an hour, and the last page rearranges the rest.',
  },
  {
    // Kafka's Metamorphosis was the intended entry here and was cut: the only
    // Gutenberg edition with a text file (#5200, the Wyllie translation) is
    // still flagged copyright, and the public-domain #26298 has no retrievable
    // text. Poe covers the same shelf with no doubt about the licence.
    slug: 'the-works-of-edgar-allan-poe-volume-2',
    noCover: true,
    pg: 2148,
    title: 'The Works of Edgar Allan Poe, Volume 2',
    author: 'Edgar Allan Poe',
    year: 1845,
    category: 'Short Stories',
    shelves: ['stories', 'gothic', 'mystery'],
    description:
      'The famous ones, in one volume: The Fall of the House of Usher, The Masque of the Red Death, The Cask of Amontillado, The Pit and the Pendulum. Twenty minutes each.',
  },
  {
    slug: 'the-legend-of-sleepy-hollow',
    pg: 41,
    title: 'The Legend of Sleepy Hollow',
    author: 'Washington Irving',
    year: 1820,
    category: 'Short Stories',
    shelves: ['stories', 'gothic'],
    description:
      'Ichabod Crane, a Dutch hollow full of superstition, and a horseman on the bridge. American folklore, invented on the spot by one man.',
  },
  {
    slug: 'the-importance-of-being-earnest',
    pg: 844,
    title: 'The Importance of Being Earnest',
    author: 'Oscar Wilde',
    year: 1895,
    category: 'Drama',
    shelves: ['stories'],
    description:
      'Two men invent fictitious relatives to get out of engagements and into others. The best-constructed joke in English, ninety minutes end to end.',
  },
  {
    slug: 'a-dolls-house',
    pg: 2542,
    title: "A Doll's House",
    author: 'Henrik Ibsen',
    year: 1879,
    category: 'Drama',
    shelves: ['stories'],
    description:
      'Nora has forged a signature to save her husband’s life, and he will not thank her for it. Ends with the most consequential door in theatre.',
  },

  // ── Lives ─────────────────────────────────────────────────────────────────
  {
    slug: 'narrative-of-the-life-of-frederick-douglass',
    pg: 23,
    title: 'Narrative of the Life of Frederick Douglass',
    author: 'Frederick Douglass',
    year: 1845,
    category: 'Autobiography',
    shelves: ['featured', 'lives'],
    featured: true,
    description:
      'Written by a man who taught himself to read while enslaved, and published while he could still be seized and returned. Two and a half hours, and unanswerable.',
  },
  {
    slug: 'the-story-of-my-life',
    noCover: true,
    pg: 2397,
    title: 'The Story of My Life',
    author: 'Helen Keller',
    year: 1903,
    category: 'Autobiography',
    shelves: ['lives'],
    description:
      'Keller was twenty-two when she wrote this. The chapter where the word "water" arrives is one of the great moments in autobiography.',
  },
  {
    slug: 'walden',
    pg: 205,
    title: 'Walden',
    author: 'Henry David Thoreau',
    year: 1854,
    category: 'Memoir',
    shelves: ['lives', 'world'],
    description:
      'Two years in a cabin he built for $28.12½, itemised. Somewhere between a household budget and a manifesto for wanting less.',
  },

  // ── Philosophy and ideas ──────────────────────────────────────────────────
  {
    slug: 'meditations',
    pg: 2680,
    title: 'Meditations',
    author: 'Marcus Aurelius',
    year: 180,
    category: 'Philosophy',
    shelves: ['featured', 'ideas'],
    featured: true,
    description:
      'The private notebook of a Roman emperor, never meant to be read. Short numbered entries, so you can put it down anywhere and lose nothing.',
  },
  {
    slug: 'the-prince',
    pg: 1232,
    title: 'The Prince',
    author: 'Niccolò Machiavelli',
    year: 1532,
    category: 'Philosophy',
    shelves: ['ideas'],
    description:
      'A job application in the form of a manual on holding power. Cold, specific, and still the book people mean when they say a name as an adjective.',
  },
  {
    slug: 'tao-te-ching',
    noCover: true,
    pg: 216,
    title: 'Tao Te Ching',
    author: 'Laozi',
    // Legge's 1891 translation is catalogued under its older romanisation.
    aka: { title: ['The Tao Teh King'] },
    year: -400,
    category: 'Philosophy',
    shelves: ['ideas'],
    description:
      'Eighty-one short chapters on doing less and yielding first. In this 1891 translation by James Legge, it takes under an hour and repays years.',
  },
  {
    slug: 'the-art-of-war',
    noCover: true,
    pg: 132,
    title: 'The Art of War',
    author: 'Sun Tzu',
    aka: { author: ['Sunzi'] },
    year: -500,
    category: 'Philosophy',
    shelves: ['ideas'],
    description:
      'Thirteen chapters on winning before the fighting starts, in Lionel Giles’ 1910 translation with the classical commentary alongside.',
  },
  {
    slug: 'dream-psychology',
    noCover: true,
    pg: 15489,
    title: 'Dream Psychology',
    author: 'Sigmund Freud',
    year: 1920,
    category: 'Psychology',
    shelves: ['ideas'],
    description:
      'Freud’s own condensed introduction to dream interpretation, written for people who were never going to read the eight-hundred-page version.',
  },
  {
    slug: 'as-a-man-thinketh',
    noCover: true,
    pg: 4507,
    title: 'As a Man Thinketh',
    author: 'James Allen',
    year: 1903,
    category: 'Self-Development',
    shelves: ['ideas'],
    description:
      'The ancestor of every book about mindset, and about forty minutes long. Allen gave it away rather than sell it.',
  },
  {
    slug: 'a-modest-proposal',
    pg: 1080,
    title: 'A Modest Proposal',
    author: 'Jonathan Swift',
    year: 1729,
    category: 'Essays',
    shelves: ['featured', 'ideas'],
    featured: true,
    description:
      'Ten minutes. Swift proposes, with impeccable arithmetic, that the Irish poor sell their children as food. The high-water mark of the straight face.',
  },
  {
    slug: 'common-sense',
    pg: 147,
    title: 'Common Sense',
    author: 'Thomas Paine',
    year: 1776,
    category: 'History',
    shelves: ['ideas', 'world'],
    description:
      'The pamphlet that argued a continent into a war, written in language a farmer could read aloud in a tavern. It sold to a fifth of the colonies.',
  },

  // ── Science, history, travel ──────────────────────────────────────────────
  {
    slug: 'on-the-origin-of-species',
    noCover: true,
    pg: 1228,
    title: 'On the Origin of Species',
    author: 'Charles Darwin',
    year: 1859,
    category: 'Science',
    shelves: ['world'],
    description:
      'Darwin’s first edition: patient, hedged, crammed with pigeons and barnacles, and building an argument he had sat on for twenty years.',
  },
  {
    slug: 'relativity',
    // Not #5001: that record carries no plain-text format. #30155 is the same
    // Robert Lawson translation, complete, with a text file.
    pg: 30155,
    title: 'Relativity: The Special and General Theory',
    author: 'Albert Einstein',
    year: 1916,
    category: 'Science',
    shelves: ['world'],
    description:
      'Einstein explaining his own work to people who are not physicists, using trains and embankments. He meant it to be readable, and it is.',
  },
  {
    slug: 'the-innocents-abroad',
    pg: 3176,
    title: 'The Innocents Abroad',
    author: 'Mark Twain',
    year: 1869,
    category: 'Travel',
    shelves: ['world'],
    description:
      'Twain on a package cruise to Europe and the Holy Land, being rude about all of it. The bestselling book of his lifetime, and the first travel comedy.',
  },
];
