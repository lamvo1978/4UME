(function () {
  var raw = new URLSearchParams(location.search).get("ma") || "";
  var code = raw.toUpperCase().replace(/[^A-Z0-9]/g, "").slice(0, 16);
  if (!code) return;

  document.getElementById("code").textContent = code;
  document.getElementById("code-card").hidden = false;

  document.getElementById("copy").addEventListener("click", function () {
    if (!navigator.clipboard) return;
    navigator.clipboard.writeText(code).then(function () {
      document.getElementById("copied").hidden = false;
    });
  });
})();
