// Signs in with the same API as the app, then deletes the account; the token lives only in this function.
(function () {
  var form = document.getElementById("form");
  var email = document.getElementById("email");
  var password = document.getElementById("password");
  var confirmBox = document.getElementById("confirm");
  var submit = document.getElementById("submit");
  var message = document.getElementById("message");
  var busy = false;

  function refresh() {
    submit.disabled = busy || !confirmBox.checked || !email.value.trim() || !password.value;
  }

  function show(text, kind) {
    message.textContent = text;
    message.className = "notice " + kind;
    message.hidden = false;
  }

  async function post(path, body, token) {
    var headers = { "Content-Type": "application/json" };
    if (token) headers.Authorization = "Bearer " + token;
    var res = await fetch(path, { method: "POST", headers: headers, body: JSON.stringify(body) });
    var data = null;
    try {
      data = await res.json();
    } catch (e) {
      data = null;
    }
    if (!res.ok) throw new Error((data && data.error) || "Có lỗi xảy ra (" + res.status + "). Vui lòng thử lại.");
    return data;
  }

  [email, password, confirmBox].forEach(function (el) {
    el.addEventListener("input", refresh);
    el.addEventListener("change", refresh);
  });

  form.addEventListener("submit", async function (e) {
    e.preventDefault();
    if (submit.disabled) return;
    busy = true;
    refresh();
    submit.textContent = "Đang xoá…";
    message.hidden = true;
    try {
      var login = await post("/api/auth/login", { email: email.value.trim(), password: password.value });
      await post("/api/me/delete", { password: password.value }, login.accessToken);
      form.reset();
      form.querySelectorAll("input, button").forEach(function (el) {
        el.disabled = true;
      });
      show("Đã xoá tài khoản và toàn bộ dữ liệu. Cảm ơn bạn đã học cùng 4UME.", "ok");
    } catch (err) {
      show(err.message, "error");
      busy = false;
      refresh();
    } finally {
      submit.textContent = "Xoá vĩnh viễn tài khoản";
    }
  });
})();
