(function () {
  var raw = new URLSearchParams(location.search).get("ma") || "";
  var code = raw.toUpperCase().replace(/[^A-Z0-9]/g, "").slice(0, 16);
  if (!code) return;

  // Codes are a two-letter prefix plus six characters, shown as "MB-K7P2X9".
  if (code.length === 8) code = code.slice(0, 2) + "-" + code.slice(2);
  document.getElementById("code").textContent = code;
  document.getElementById("code-card").hidden = false;

  document.getElementById("copy").addEventListener("click", function () {
    if (!navigator.clipboard) return;
    navigator.clipboard.writeText(code).then(function () {
      document.getElementById("copied").hidden = false;
    });
  });
})();
