/* NENE AI sign-in UI. Requires public values in auth-config.js. */
(function () {
  "use strict";

  const config = window.NENE_AUTH_CONFIG || {};
  let client = null;
  let authSubscription = null;

  function configured() {
    return typeof config.supabaseUrl === "string" &&
      /^https:\/\//i.test(config.supabaseUrl) &&
      typeof config.supabaseAnonKey === "string" &&
      config.supabaseAnonKey.length > 10;
  }

  function initClient() {
    if (client) return client;
    if (!configured()) return null;
    if (!window.supabase || typeof window.supabase.createClient !== "function") {
      throw new Error("The sign-in library could not load. Check your connection and try again.");
    }
    client = window.supabase.createClient(config.supabaseUrl, config.supabaseAnonKey, {
      auth: {
        storage: window.sessionStorage,
        persistSession: true,
        autoRefreshToken: true,
        detectSessionInUrl: true
      }
    });
    if (!authSubscription) {
      const result = client.auth.onAuthStateChange((_event, session) => {
        updateAuthUi(session?.user || null);
      });
      authSubscription = result?.data?.subscription || null;
    }
    return client;
  }

  function setMessage(message, isError) {
    const node = document.getElementById("neneAuthMessage");
    if (!node) return;
    node.textContent = message || "";
    node.style.color = isError ? "#ffb0a8" : "#d7c28f";
  }

  function updateAuthUi(user) {
    const button = document.getElementById("neneAuthHeaderButton");
    if (button) button.textContent = user ? "Account" : "Sign in";
    const summary = document.getElementById("neneAuthSummary");
    if (summary) {
      summary.textContent = user
        ? "Signed in as " + (user.email || "NENE AI user") + ". Your account is verified by the identity provider."
        : configured()
          ? "You are not signed in. Sign in to connect your NENE AI account."
          : "Secure sign-in is being prepared. Account creation is unavailable until NENE AI authentication is configured.";
    }
    const accountName = document.getElementById("neneAuthAccountName");
    if (accountName) accountName.textContent = user?.email || "Not signed in";
  }

  async function currentUser() {
    const auth = initClient();
    if (!auth) return null;
    const { data, error } = await auth.auth.getSession();
    if (error) throw error;
    updateAuthUi(data.session?.user || null);
    return data.session?.user || null;
  }

  window.neneAuthGetAccessToken = async function () {
    const auth = initClient();
    if (!auth) return null;
    const { data, error } = await auth.auth.getSession();
    if (error) throw error;
    return data.session?.access_token || null;
  };

  window.neneAuthHeaders = async function (headers) {
    const output = Object.assign({}, headers || {});
    const token = await window.neneAuthGetAccessToken();
    if (token) output.Authorization = "Bearer " + token;
    return output;
  };

  window.neneOpenAuth = function (mode) {
    mode = mode || "signin";
    if (!configured()) {
      showModal(
        '<div class="eyebrow">Secure account</div>' +
        '<h2>Sign-in setup is not finished</h2>' +
        '<p class="subtitle">NENE AI has not been connected to its official authentication project yet. For your protection, this form will not collect your password until the project is configured.</p>' +
        '<div class="notice">Next: configure the NENE AI Supabase project, add its public project URL and publishable key to auth-config.js, configure verified backend authentication, then test sign-in and account recovery.</div>' +
        '<button class="btn gold" style="margin-top:12px" onclick="closeModal()">Close</button>'
      );
      return;
    }

    try { initClient(); }
    catch (error) {
      showModal('<h2>Sign-in unavailable</h2><p class="subtitle">The secure sign-in library did not load. Please try again later.</p><button class="btn gold" onclick="closeModal()">Close</button>');
      return;
    }

    const title = mode === "signup" ? "Create your account" :
      mode === "reset" ? "Reset your password" : "Welcome back";
    const submit = mode === "signup" ? "Create account" :
      mode === "reset" ? "Send reset link" : "Sign in";
    const passwordField = mode === "reset" ? "" :
      '<div class="block"><div class="label" for="neneAuthPassword">Password</div><input class="field" id="neneAuthPassword" type="password" autocomplete="' +
      (mode === "signup" ? "new-password" : "current-password") +
      '" minlength="8" required></div>';

    showModal(
      '<div class="eyebrow">NENE AI account</div>' +
      '<h2>' + title + '</h2>' +
      '<p class="subtitle">Use your email to securely access your account across supported devices.</p>' +
      '<form id="neneAuthForm" novalidate>' +
      '<div class="block"><div class="label" for="neneAuthEmail">Email address</div><input class="field" id="neneAuthEmail" type="email" autocomplete="email" maxlength="254" required></div>' +
      passwordField +
      '<button class="btn gold" id="neneAuthSubmit" type="submit">' + submit + '</button>' +
      '</form>' +
      '<div id="neneAuthMessage" role="status" aria-live="polite" style="font-size:12px;line-height:1.5;margin-top:12px"></div>' +
      '<div class="list" style="margin-top:12px">' +
      (mode !== "signin" ? '<button class="btn" type="button" onclick="neneOpenAuth(\'signin\')">I already have an account</button>' : '') +
      (mode !== "signup" ? '<button class="btn" type="button" onclick="neneOpenAuth(\'signup\')">Create an account</button>' : '') +
      (mode !== "reset" ? '<button class="btn" type="button" onclick="neneOpenAuth(\'reset\')">Forgot password?</button>' : '') +
      '<button class="btn" type="button" onclick="closeModal()">Cancel</button>' +
      '</div>'
    );

    const form = document.getElementById("neneAuthForm");
    const submitButton = document.getElementById("neneAuthSubmit");
    if (!form) return;
    form.addEventListener("submit", async function (event) {
      event.preventDefault();
      const emailNode = document.getElementById("neneAuthEmail");
      const passwordNode = document.getElementById("neneAuthPassword");
      const email = (emailNode?.value || "").trim().toLowerCase();
      const password = passwordNode?.value || "";
      if (!email || !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) {
        setMessage("Enter a valid email address.", true);
        return;
      }
      if (mode !== "reset" && password.length < 8) {
        setMessage("Use a password with at least 8 characters.", true);
        return;
      }
      submitButton.disabled = true;
      submitButton.textContent = "Please wait…";
      setMessage("", false);
      try {
        const auth = initClient();
        let result;
        if (mode === "signup") {
          result = await auth.auth.signUp({
            email,
            password,
            options: { emailRedirectTo: config.redirectTo || window.location.origin }
          });
          if (!result.error && !result.data.session) {
            setMessage("Account created. Check your email to confirm your address, then sign in.", false);
            return;
          }
        } else if (mode === "reset") {
          result = await auth.auth.resetPasswordForEmail(email, {
            redirectTo: config.redirectTo || window.location.origin
          });
          if (!result.error) {
            setMessage("If an account exists for that email, a password-reset message will be sent.", false);
            return;
          }
        } else {
          result = await auth.auth.signInWithPassword({ email, password });
        }
        if (result.error) throw result.error;
        updateAuthUi(result.data?.user || result.data?.session?.user || null);
        setMessage("You are signed in. NENE AI will send your verified access token with protected backend requests.", false);
        window.setTimeout(() => closeModal(), 900);
      } catch (error) {
        const raw = String(error?.message || "");
        const safeMessage = /invalid login credentials/i.test(raw)
          ? "Email or password is incorrect."
          : /already registered/i.test(raw)
            ? "An account may already exist. Try signing in or resetting your password."
            : /network|fetch/i.test(raw)
              ? "Could not reach the sign-in service. Check your connection and try again."
              : "We could not complete that request. Check the details and try again.";
        setMessage(safeMessage, true);
      } finally {
        if (document.getElementById("neneAuthSubmit")) {
          submitButton.disabled = false;
          submitButton.textContent = submit;
        }
      }
    });
  };

  window.neneSignOut = async function () {
    try {
      const auth = initClient();
      if (!auth) {
        window.neneOpenAuth("signin");
        return;
      }
      const { error } = await auth.auth.signOut();
      if (error) throw error;
      updateAuthUi(null);
      if (typeof toast === "function") toast("You have signed out.");
    } catch (_error) {
      if (typeof toast === "function") toast("Sign-out failed. Please try again.");
    }
  };

  document.addEventListener("DOMContentLoaded", async function () {
    try {
      if (configured()) await currentUser();
      else updateAuthUi(null);
    } catch (_error) {
      updateAuthUi(null);
    }
  });
})();
