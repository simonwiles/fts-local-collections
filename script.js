let dirHandle;
let idx;
const documents = [];
const logEl = document.getElementById("log");
const resultsEl = document.getElementById("results");
const loaderEl = document.querySelector("img.loader");

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
  logEl.innerText += `Folder "${dirHandle.name}" selected.\n\n`;
};

// Custom plugin to make matched terms available in their original form
//  (for the purpose of highlighting in context)
var originalWordMetadata = (builder) => {
  // Define a pipeline function that stores the token length as metadata
  var pipelineFunction = (token) => {
    token.metadata["originalWord"] = token.toString();
    return token;
  };

  // Register the pipeline function so the index can be serialised
  lunr.Pipeline.registerFunction(pipelineFunction, "originalWordMetadata");

  // Add the pipeline function to the indexing pipeline
  builder.pipeline.before(lunr.stemmer, pipelineFunction);

  // Whitelist the tokenLength metadata key
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
  logEl.innerText += `Reading contents of ${dirHandle.name}...`;
  await readFileContents();
  logEl.innerText += ` done! [Read ${documents.length} files in ${
    (new Date() - t) / 1000
  }s]\n\n`;

  logEl.innerText += "Building index...";
  setTimeout(() => {
    t = new Date();
    buildIdx();
    logEl.innerText += ` done! [${(new Date() - t) / 1000}s elapsed]\n\n`;
    loaderEl.style.display = "none";
  }, 100);
};

const flattenMatches = (result) => {
  return Object.values(result.matchData.metadata)
    .map(({ text }) => text.originalWord)
    .flat();
};

const doSearch = () => {
  const searchTerms = document.getElementById("search-terms").value;
  logEl.innerText += `Searching for ${searchTerms}...\n\n`;
  let t = new Date();
  const results = idx.search(searchTerms);
  resultsEl.innerText += `Found results in ${results.length} files! [${
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
document
  .getElementById("clear")
  .addEventListener("click", () => (resultsEl.innerText = ""));
