import fs from "node:fs/promises";

const ports = JSON.parse(await fs.readFile("./src/data/ports.json", "utf-8"));

const releasesPath = "./src/data/releases.json";

let previousReleases = {};

try {
  previousReleases = JSON.parse(await fs.readFile(releasesPath, "utf-8"));
} catch {
  previousReleases = {};
}

// Conservamos los datos anteriores.
const releases = { ...previousReleases };

for (const port of ports) {
  const url = `https://api.github.com/repos/${port.repository}/releases?per_page=10`;

  try {
    const response = await fetch(url, {
      headers: {
        Accept: "application/vnd.github+json",
        Authorization: `Bearer ${process.env.GITHUB_TOKEN}`,
      },
    });

    if (!response.ok) {
      console.error(`Error en ${port.name}: ${response.status}`);

      // Si todavía no existe, lo agregamos igualmente.
      if (!releases[port.id]) {
        releases[port.id] = {
          ...port,
          hasRelease: false,
        };
      }

      continue;
    }

    const data = await response.json();

    const latest = data
      .filter((release) => !release.draft)
      .sort((a, b) => new Date(b.published_at) - new Date(a.published_at))[0];

    if (!latest) {
      releases[port.id] = {
        ...port,
        hasRelease: false,
      };

      continue;
    }

    const previousTag = previousReleases[port.id]?.tag;

    releases[port.id] = {
      ...port,
      hasRelease: true,
      tag: latest.tag_name,
      title: latest.name || latest.tag_name,
      date: latest.published_at,
      url: latest.html_url,
      prerelease: latest.prerelease,
      isNew: previousTag ? previousTag !== latest.tag_name : false,
    };

    console.log(`${port.name}: ${latest.tag_name}`);
  } catch (error) {
    console.error(`Error en ${port.name}:`, error);

    if (!releases[port.id]) {
      releases[port.id] = {
        ...port,
        hasRelease: false,
      };
    }
  }
}

await fs.writeFile(releasesPath, JSON.stringify(releases, null, 2));
