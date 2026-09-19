const env = require("./env");

function isConfigured() {
  return Boolean(env.githubToken && env.githubRepoOwner && env.githubRepoName);
}

async function request(path, options = {}, retries = 3) {
  if (!isConfigured()) {
    throw new Error("GitHub repository syncing is not configured. Missing GITHUB_TOKEN, GITHUB_REPO_OWNER, or GITHUB_REPO_NAME.");
  }
  const url = `https://api.github.com/repos/${env.githubRepoOwner}/${env.githubRepoName}${path}`;
  
  let lastError;
  for (let attempt = 1; attempt <= retries; attempt++) {
    try {
      const res = await fetch(url, {
        ...options,
        headers: {
          "authorization": `Bearer ${env.githubToken}`,
          "accept": "application/vnd.github+json",
          "user-agent": "abantika-admin-sync",
          "x-github-api-version": "2022-11-28",
          ...(options.headers || {})
        }
      });

      const text = await res.text();
      let data;
      try {
        data = JSON.parse(text);
      } catch (e) {
        data = { raw: text };
      }

      if (!res.ok) {
        const errorMsg = data.message || res.statusText || "GitHub API Error";
        // Do not retry 4xx auth or client errors except 429 rate limits
        if (res.status >= 400 && res.status < 500 && res.status !== 429) {
          throw new Error(`GitHub Sync Failed (${res.status}): ${errorMsg}`);
        }
        throw new Error(`GitHub Sync Temporary Error (${res.status}): ${errorMsg}`);
      }
      return data;
    } catch (err) {
      lastError = err;
      if (err.message.includes("GitHub Sync Failed (40") && !err.message.includes("429")) {
        throw err; // Permanent client error, don't retry
      }
      if (attempt < retries) {
        await new Promise((r) => setTimeout(r, attempt * 1000));
      }
    }
  }
  throw lastError || new Error("GitHub Sync Failed after retries.");
}

async function createBlob(content, isBase64 = false) {
  const payload = isBase64
    ? { content: content, encoding: "base64" }
    : { content: String(content), encoding: "utf-8" };
  const res = await request("/git/blobs", {
    method: "POST",
    headers: { "content-type": "application/json" },
    body: JSON.stringify(payload)
  });
  return res.sha;
}

async function commitFiles(files = [], commitMessage = "content: update site files") {
  if (!isConfigured()) {
    return { synced: false, reason: "not_configured" };
  }
  if (!files.length) {
    return { synced: false, reason: "no_files" };
  }

  const branch = env.githubBranch || "main";
  const refRes = await request(`/git/ref/heads/${branch}`);
  const latestCommitSha = refRes.object.sha;

  const latestCommit = await request(`/git/commits/${latestCommitSha}`);
  const baseTreeSha = latestCommit.tree.sha;

  const treeItems = [];

  for (const file of files) {
    const relPath = file.path.replace(/^\/+/, "").replace(/\\/g, "/");
    if (file.isDelete) {
      treeItems.push({
        path: relPath,
        mode: "100644",
        type: "blob",
        sha: null
      });
    } else {
      const blobSha = await createBlob(file.content, file.isBase64);
      treeItems.push({
        path: relPath,
        mode: "100644",
        type: "blob",
        sha: blobSha
      });
    }
  }

  const newTree = await request("/git/trees", {
    method: "POST",
    headers: { "content-type": "application/json" },
    body: JSON.stringify({
      base_tree: baseTreeSha,
      tree: treeItems
    })
  });

  const newCommit = await request("/git/commits", {
    method: "POST",
    headers: { "content-type": "application/json" },
    body: JSON.stringify({
      message: commitMessage,
      tree: newTree.sha,
      parents: [latestCommitSha]
    })
  });

  await request(`/git/refs/heads/${branch}`, {
    method: "PATCH",
    headers: { "content-type": "application/json" },
    body: JSON.stringify({
      sha: newCommit.sha,
      force: false
    })
  });

  return {
    synced: true,
    sha: newCommit.sha,
    url: newCommit.html_url || `https://github.com/${env.githubRepoOwner}/${env.githubRepoName}/commit/${newCommit.sha}`
  };
}

async function getRepoStatus() {
  if (!isConfigured()) return { configured: false };
  try {
    const repo = await request("");
    return {
      configured: true,
      name: repo.full_name,
      defaultBranch: repo.default_branch,
      private: repo.private
    };
  } catch (err) {
    return { configured: true, error: err.message };
  }
}

module.exports = {
  isConfigured,
  commitFiles,
  getRepoStatus
};
