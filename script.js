let dirHandle;
let idx;
const documents = [];
const logEl = document.getElementById("log");
const resultsEl = document.getElementById("results");
const loaderEl = document.querySelector("img.loader");

const log = (text, end = "\n\n") => {
  logEl.innerText += text;
  logEl.innerText += end;
  logEl.scrollTop = logEl.scrollHeight;
};

async function* getFilesRecursively(entry, pathname) {
  if (entry.kind === "file") {
    const file = await entry.getFile();
    if (file !== null) {
      file.relativePath = pathname;
      yield file;
    }
  } else if (entry.kind === "directory") {
    for await (const handle of entry.values()) {
      yield* getFilesRecursively(handle, pathname + `/${handle.name}`);
    }
  }
}

const getHandle = async () => {
  dirHandle = await showDirectoryPicker({ id: "winnow" });
  log(`Folder "${dirHandle.name}" selected.`);
  document.getElementById("index").disabled = false;
};

const originalWordMetadata = (builder) => {
  const pipelineFunction = (token) => {
    token.metadata["originalWord"] = token.toString();
    return token;
  };
  lunr.Pipeline.registerFunction(pipelineFunction, "originalWordMetadata");
  builder.pipeline.before(lunr.stemmer, pipelineFunction);
  builder.metadataWhitelist.push("originalWord");
};

const readFileContents = async () => {
  for await (const fileHandle of getFilesRecursively(
    dirHandle,
    dirHandle.name,
  )) {
    documents.push({ id: fileHandle.name, text: await fileHandle.text() });
  }
};

const buildIdx = () => {
  idx = lunr(function () {
    this.ref("id");
    this.field("text");
    this.use(originalWordMetadata);
    documents.forEach((doc) => this.add(doc));
  });
};

const buildIndex = async () => {
  loaderEl.style.display = "inline";
  let t = new Date();
  log(`Reading contents of ${dirHandle.name}...`, "");
  await readFileContents();
  log(` done! [Read ${documents.length} files in ${(new Date() - t) / 1000}s]`);

  log("Building index...", "");
  setTimeout(() => {
    t = new Date();
    buildIdx();
    log(` done! [${(new Date() - t) / 1000}s elapsed]`);
    loaderEl.style.display = "none";
    document.getElementById("search").disabled = false;
    document.getElementById("search-terms").disabled = false;
  }, 100);
};

const flattenMatches = (result) => {
  return Object.values(result.matchData.metadata)
    .map(({ text }) => text.originalWord)
    .flat();
};

const doSearch = () => {
  const searchTerms = document.getElementById("search-terms").value;
  log(`Searching for ${searchTerms}...`);
  let t = new Date();
  const results = idx.search(searchTerms);
  resultsEl.innerText = `Found results in ${results.length} files! [${
    (new Date() - t) / 1000
  }s elapsed]\n\n`;

  results.forEach((result) => {
    const flattenedMatches = flattenMatches(result);
    resultsEl.innerText += ` => [${result.score}] ${result.ref}: found ${
      flattenedMatches.length
    } matches\n${flattenedMatches.join(", ")}\n\n`;
  });
};

document.getElementById("select").addEventListener("click", getHandle);
document.getElementById("index").addEventListener("click", buildIndex);
document.getElementById("search").addEventListener("click", doSearch);
