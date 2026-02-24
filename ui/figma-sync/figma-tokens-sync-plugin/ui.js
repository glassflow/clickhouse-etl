(function () {
  var fileInput = document.getElementById("file");
  var pasteArea = document.getElementById("paste");
  var createMissing = document.getElementById("createMissing");
  var previewBtn = document.getElementById("preview");
  var applyBtn = document.getElementById("apply");
  var summaryEl = document.getElementById("summary");
  var statusEl = document.getElementById("status");

  function setStatus(text, isError) {
    statusEl.textContent = text;
    statusEl.className = "status " + (isError ? "error" : "");
    statusEl.style.display = text ? "block" : "none";
  }

  function setButtonsDisabled(disabled) {
    previewBtn.disabled = applyBtn.disabled = disabled;
  }

  function getPayload() {
    var raw = pasteArea.value.trim();
    if (!raw) {
      setStatus("Please upload a JSON file or paste JSON above.", true);
      summaryEl.style.display = "none";
      return null;
    }
    try {
      return JSON.parse(raw);
    } catch (e) {
      summaryEl.style.display = "none";
      setStatus("Invalid JSON: " + e.message, true);
      return null;
    }
  }

  function showResult(result, isPreview) {
    setButtonsDisabled(false);
    setStatus("");
    summaryEl.classList.remove("error");
    summaryEl.style.display = "block";
    var lines = [];
    if (result.errors && result.errors.length) {
      lines.push("Errors:\n" + result.errors.join("\n"));
    }
    if (result.missingCollections && result.missingCollections.length) {
      lines.push("Missing collections: " + result.missingCollections.join(", "));
    }
    if (result.missingVariables && result.missingVariables.length) {
      var byColl = {};
      result.missingVariables.forEach(function (m) {
        if (!byColl[m.collection]) byColl[m.collection] = [];
        byColl[m.collection].push(m.variable);
      });
      lines.push("Missing variables:\n" + Object.keys(byColl).map(function (c) {
        return "  " + c + ": " + byColl[c].join(", ");
      }).join("\n"));
    }
    if (result.updated && result.updated.length) {
      lines.push((isPreview ? "Would update: " : "Updated: ") + result.updated.length + " variable(s)");
      if (result.updated.length <= 20) {
        lines.push(result.updated.join("\n"));
      } else {
        lines.push(result.updated.slice(0, 15).join("\n") + "\n... and " + (result.updated.length - 15) + " more");
      }
    }
    if (result.created && result.created.length) {
      lines.push((isPreview ? "Would create: " : "Created: ") + result.created.length + " variable(s)");
      if (result.created.length <= 15) {
        lines.push(result.created.join("\n"));
      } else {
        lines.push(result.created.slice(0, 10).join("\n") + "\n... and " + (result.created.length - 10) + " more");
      }
    }
    if (lines.length === 0 && !(result.errors && result.errors.length)) {
      lines.push("Done. No variables to update (all matched or nothing in file).");
    }
    summaryEl.textContent = lines.join("\n\n");
    var hasErrors = result.errors && result.errors.length > 0;
    if (hasErrors) summaryEl.classList.add("error");
    if (!isPreview) {
      setStatus(
        "Sync complete. " + (result.updated ? result.updated.length : 0) + " updated, " +
        (result.created ? result.created.length : 0) + " created." +
        (hasErrors ? " See errors below." : ""),
        hasErrors
      );
    }
  }

  fileInput.addEventListener("change", function () {
    var f = fileInput.files[0];
    if (!f) return;
    setStatus("");
    var r = new FileReader();
    r.onload = function () {
      pasteArea.value = r.result;
      setStatus("File loaded. Click Preview or Apply.");
    };
    r.readAsText(f);
  });

  previewBtn.addEventListener("click", function () {
    var payload = getPayload();
    if (!payload) return;
    setStatus("Previewing…");
    setButtonsDisabled(true);
    summaryEl.style.display = "block";
    summaryEl.textContent = "Loading…";
    parent.postMessage({ pluginMessage: { type: "PREVIEW", payload: payload, createMissingVariables: false } }, "*");
  });

  applyBtn.addEventListener("click", function () {
    var payload = getPayload();
    if (!payload) return;
    setStatus("Syncing…");
    setButtonsDisabled(true);
    summaryEl.style.display = "block";
    summaryEl.textContent = "Applying…";
    parent.postMessage({ pluginMessage: { type: "APPLY", payload: payload, createMissingVariables: createMissing.checked } }, "*");
  });

  window.onmessage = function (event) {
    var msg = event.data && event.data.pluginMessage;
    if (!msg) return;
    if (msg.type === "RESULT" && msg.result) {
      showResult(msg.result, msg.preview === true);
    }
  };
})();
