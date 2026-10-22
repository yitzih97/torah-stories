// The angles each topic is written from. Each one targets a real search phrase
// ("lech lecha story for kids", "chanukah activities for preschool") and has to
// give the reader something they can use, which is what keeps thousands of
// articles from reading as mass-produced filler.
//
// {name} is the topic's search name ("Parshas Lech Lecha", "Chanukah").

export const ARTICLE_TYPES = {
  "story-for-kids": {
    title: "{name} Story for Kids",
    keyword: "{name} story for kids",
    brief:
      "Retell the story for children aged 4 to 9, read-aloud length (600 to 900 words of story), warm and vivid, pshat with well-known Rashi and Midrash. After the story, a short section for parents: the main lesson, and three questions to ask the child.",
    words: [900, 1400],
    categories: ["torah", "holidays", "neviim", "ketuvim", "midrash", "tzadikim", "mitzvot", "middos", "life"],
    priority: 1,
  },
  "summary-for-kids": {
    title: "{name} Summary for Kids",
    keyword: "{name} summary for kids",
    brief:
      "A clear summary of the whole parsha, aliyah by aliyah or event by event, in simple language a child of 8 can follow and a parent can read in five minutes. End with the parsha's key lesson in one paragraph and a list of the main people and places.",
    words: [800, 1200],
    categories: ["torah"],
    priority: 2,
  },
  "shabbos-table-questions": {
    title: "{name}: Questions for the Shabbos Table",
    keyword: "{name} questions for kids",
    brief:
      "Twelve to fifteen questions for the Shabbos or Yom Tov table, grouped by age (little ones, middle, older children), each with a short answer for the parent. Include a few 'what would you do' questions that connect the topic to a child's day.",
    words: [900, 1400],
    categories: ["torah", "holidays", "neviim", "ketuvim", "midrash", "mitzvot", "middos", "life"],
    priority: 2,
  },
  "dvar-torah-for-kids": {
    title: "Short Dvar Torah for Kids on {name}",
    keyword: "{name} dvar torah for kids",
    brief:
      "Three short divrei Torah a child can say at the Shabbos table, each 120 to 200 words, each built on one well-known idea (Rashi, Midrash, or a classic vort), each ending with a takeaway. Give a one-line source note for each idea. Add a short tip for parents on helping a child say it.",
    words: [800, 1200],
    categories: ["torah", "holidays"],
    priority: 2,
  },
  "activities-and-crafts": {
    title: "{name} Activities and Crafts for Kids",
    keyword: "{name} activities for kids",
    brief:
      "Eight to ten hands-on activities, crafts and games for home or classroom, each with materials, steps and the connection to the topic. Use cheap household materials. Mark which suit preschool and which suit older children.",
    words: [900, 1400],
    categories: ["torah", "holidays", "neviim", "ketuvim", "mitzvot", "middos", "life"],
    priority: 3,
  },
  "quiz-for-kids": {
    title: "{name} Quiz for Kids (with Answers)",
    keyword: "{name} quiz",
    brief:
      "Twenty quiz questions in three levels (easy, medium, challenge), multiple choice or short answer, followed by an answer key with a one-line explanation for each answer. Good for a Shabbos table game or a classroom review.",
    words: [800, 1300],
    categories: ["torah", "holidays", "neviim", "ketuvim", "tzadikim", "midrash"],
    priority: 3,
  },
  "middos-lesson": {
    title: "What {name} Teaches Children",
    keyword: "{name} lesson for kids",
    brief:
      "The middos and life lessons in this topic, three to five of them, each explained for parents with an everyday example from a child's life and a practical way to practise it this week.",
    words: [900, 1300],
    categories: ["torah", "neviim", "ketuvim", "midrash", "tzadikim", "mitzvot", "middos"],
    priority: 3,
  },
  "preschool-ideas": {
    title: "Teaching {name} to Preschoolers",
    keyword: "{name} preschool",
    brief:
      "A guide for parents and morahs of children aged 2 to 5: the story in a few simple sentences, songs or chants (original, never copied lyrics), sensory and circle-time ideas, a snack idea, and words to use. Practical and short paragraphs.",
    words: [800, 1200],
    categories: ["torah", "holidays", "mitzvot", "middos"],
    priority: 4,
  },
  "facts-for-kids": {
    title: "{name}: Facts for Kids",
    keyword: "{name} facts for kids",
    brief:
      "Fifteen to twenty interesting, accurate facts about the topic, each a short paragraph, drawn from the pesukim, Rashi, Midrash and well-known tradition (say which). Things a child would love to repeat at the table.",
    words: [800, 1200],
    categories: ["torah", "holidays", "tzadikim", "neviim", "ketuvim"],
    priority: 4,
  },
  "bedtime-story": {
    title: "{name} Bedtime Story",
    keyword: "{name} bedtime story",
    brief:
      "A calm, gentle bedtime retelling for ages 3 to 7, 500 to 800 words, soft pacing and a peaceful ending, finishing with a short Shema-time thought connecting the story to trusting Hashem.",
    words: [600, 1000],
    categories: ["torah", "neviim", "ketuvim", "midrash", "tzadikim", "middos", "mitzvot"],
    priority: 5,
  },
  "teaching-guide": {
    title: "How to Teach Kids About {name}",
    keyword: "teaching kids about {name}",
    brief:
      "A practical parent's guide: why it matters, how to explain it at different ages, common questions children ask and good answers, small daily habits that build it, and how to praise it when you see it.",
    words: [900, 1300],
    categories: ["mitzvot", "middos", "life", "holidays"],
    priority: 2,
  },
};

/** Which article types a topic gets, highest-priority first. */
export const typesFor = (topic) =>
  Object.entries(ARTICLE_TYPES)
    .filter(([, t]) => t.categories.includes(topic.category))
    .sort((a, b) => a[1].priority - b[1].priority)
    .map(([key]) => key);
