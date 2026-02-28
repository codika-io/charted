# Contributing to Charted

Thanks for your interest in mapping the sciences!

## Adding a topic

1. Create an MDX file in `src/content/topics/<discipline>/<topic-name>.mdx`
2. Add frontmatter:

```yaml
---
title: Topic Name
description: A one-sentence description.
parent: mathematics
color: "#ef4444"
difficulty: beginner # beginner | intermediate | advanced
prerequisites: [] # slugs of prerequisite topics
status: stub # stub | draft | complete
---
```

3. Write the content using Markdown. Keep it concise — explain what the topic is, why it matters, and what its key sub-areas are.
4. Open a pull request.

## Editing an existing topic

Click the "Edit on GitHub" button on any topic page, or find the MDX file in `src/content/topics/`.

## Development

```bash
npm install
npm run dev
```

## Guidelines

- **Be accurate.** Cite sources where possible.
- **Be concise.** This is a map, not an encyclopedia.
- **Show connections.** Explain how topics relate to each other.
- **Use clear language.** Aim for accessibility without sacrificing precision.
