// Secura — Firebase SDK Bridge & Configuration

export const firebaseConfig = {
  apiKey: process.env.NEXT_PUBLIC_FIREBASE_API_KEY || "",
  authDomain: process.env.NEXT_PUBLIC_FIREBASE_AUTH_DOMAIN || "secura-35ffc.firebaseapp.com",
  projectId: process.env.NEXT_PUBLIC_FIREBASE_PROJECT_ID || "secura-35ffc",
  storageBucket: process.env.NEXT_PUBLIC_FIREBASE_STORAGE_BUCKET || "secura-35ffc.firebasestorage.app",
  messagingSenderId: process.env.NEXT_PUBLIC_FIREBASE_MESSAGING_SENDER_ID || "176274366852",
  appId: process.env.NEXT_PUBLIC_FIREBASE_APP_ID || "1:176274366852:web:7ed59eaf649c3d6c01bdd1",
};

export interface FirebaseUser {
  uid: string;
  email: string | null;
  displayName: string | null;
  photoURL: string | null;
  githubUsername?: string;
  githubProfileUrl?: string;
  githubReposCount?: number;
}

export interface UserCredential {
  user: FirebaseUser;
  accessToken?: string;
}

// Safe provider objects
export const googleProvider = { providerId: "google.com" };
export const githubProvider = { providerId: "github.com" };
export const auth = { currentUser: null as FirebaseUser | null };
export const app = { name: "[DEFAULT]", options: firebaseConfig };

let cachedFirebaseInstance: any = null;

// Universal runtime loader for the live Firebase Web SDK
async function getLiveFirebase() {
  if (typeof window === "undefined") return null;
  if (cachedFirebaseInstance) return cachedFirebaseInstance;

  try {
    let appModule: any;
    let authModule: any;

    try {
      // 1. Try local node_modules
      const evalImport = new Function("pkg", "return import(pkg)");
      appModule = await evalImport("firebase/app");
      authModule = await evalImport("firebase/auth");
    } catch {
      // 2. Load directly from Google's official Firebase CDN in browser
      const evalImport = new Function("pkg", "return import(pkg)");
      appModule = await evalImport("https://www.gstatic.com/firebasejs/11.3.0/firebase-app.js");
      authModule = await evalImport("https://www.gstatic.com/firebasejs/11.3.0/firebase-auth.js");
    }

    const liveApp =
      appModule.getApps().length > 0
        ? appModule.getApp()
        : appModule.initializeApp(firebaseConfig);
    const liveAuth = authModule.getAuth(liveApp);

    const liveGoogle = new authModule.GoogleAuthProvider();
    liveGoogle.addScope("email");
    liveGoogle.addScope("profile");
    liveGoogle.addScope("openid");
    liveGoogle.setCustomParameters({ prompt: "select_account" });

    const liveGithub = new authModule.GithubAuthProvider();
    liveGithub.addScope("read:user");
    liveGithub.addScope("user:email");

    cachedFirebaseInstance = {
      auth: liveAuth,
      googleProvider: liveGoogle,
      githubProvider: liveGithub,
      GithubAuthProvider: authModule.GithubAuthProvider,
      GoogleAuthProvider: authModule.GoogleAuthProvider,
      getAdditionalUserInfo: authModule.getAdditionalUserInfo,
      signInWithPopup: authModule.signInWithPopup,
      ["signInWithEmailAndPassword"]: authModule.signInWithEmailAndPassword,
      ["createUserWithEmailAndPassword"]: authModule.createUserWithEmailAndPassword,
      signOut: authModule.signOut,
    };

    return cachedFirebaseInstance;
  } catch (err) {
    console.error("Firebase SDK runtime initialization failed:", err);
    return null;
  }
}

export async function fetchGitHubUserProfile(usernameOrToken: string, isToken: boolean = false) {
  try {
    const url = isToken ? "https://api.github.com/user" : `https://api.github.com/users/${encodeURIComponent(usernameOrToken)}`;
    const headers: Record<string, string> = { Accept: "application/vnd.github.v3+json" };
    if (isToken) {
      headers["Authorization"] = `Bearer ${usernameOrToken}`;
    }
    const res = await fetch(url, { headers });
    if (!res.ok) return null;
    const data = await res.json();
    let email = (data.email || "") as string;

    if (isToken && (!email || email.includes("noreply"))) {
      try {
        const emailsRes = await fetch("https://api.github.com/user/emails", { headers });
        if (emailsRes.ok) {
          const emails = await emailsRes.json();
          if (Array.isArray(emails)) {
            const primaryVerified = emails.find((e: any) => e.primary && e.verified);
            const verified = emails.find((e: any) => e.verified && !e.email?.includes("noreply"));
            const firstReal = emails.find((e: any) => e.email && !e.email?.includes("noreply"));
            email = primaryVerified?.email || verified?.email || firstReal?.email || email;
          }
        }
      } catch {}
    }

    return {
      login: data.login as string,
      name: (data.name || data.login) as string,
      avatarUrl: (data.avatar_url || "") as string,
      email: email,
      htmlUrl: (data.html_url || `https://github.com/${data.login}`) as string,
      publicRepos: Number(data.public_repos || 0),
    };
  } catch {
    return null;
  }
}

export async function signInWithPopup(
  _auth: any,
  provider: any
): Promise<UserCredential> {
  const isGithub = provider?.providerId === "github.com";
  const live = await getLiveFirebase();

  if (live) {
    const liveProvider = isGithub ? live.githubProvider : live.googleProvider;
    const result = await live.signInWithPopup(live.auth, liveProvider);

    let additionalInfo: any = null;
    try {
      if (typeof live.getAdditionalUserInfo === "function") {
        additionalInfo = live.getAdditionalUserInfo(result);
      }
    } catch (e) {
      console.warn("Could not retrieve getAdditionalUserInfo:", e);
    }

    if (isGithub) {
      let ghLogin: string | undefined = additionalInfo?.username || (additionalInfo?.profile as any)?.login;
      let ghProfileName: string | undefined = (additionalInfo?.profile as any)?.name;
      let ghAvatar: string | undefined = (additionalInfo?.profile as any)?.avatar_url;
      let ghHtmlUrl: string | undefined = (additionalInfo?.profile as any)?.html_url;
      let ghPublicRepos: number | undefined = (additionalInfo?.profile as any)?.public_repos;

      let ghEmail: string | undefined = undefined;

      // 1. Attempt token-based retrieval from OAuth credential
      try {
        const cred = live.GithubAuthProvider?.credentialFromResult?.(result);
        const ghOAuth = cred?.accessToken || (result as any)?.credential?.accessToken;
        if (ghOAuth) {
          const profile = await fetchGitHubUserProfile(ghOAuth, true);
          if (profile) {
            if (!ghLogin) ghLogin = profile.login;
            if (!ghProfileName && profile.name) ghProfileName = profile.name;
            if (!ghAvatar && profile.avatarUrl) ghAvatar = profile.avatarUrl;
            if (!ghHtmlUrl && profile.htmlUrl) ghHtmlUrl = profile.htmlUrl;
            if (ghPublicRepos === undefined) ghPublicRepos = profile.publicRepos;
            if (profile.email && !profile.email.includes("noreply")) {
              ghEmail = profile.email;
            }
          }
        }
      } catch (e) {
        console.warn("Could not fetch extra GitHub OAuth metadata:", e);
      }

      // 2. Fallback screenName extraction
      if (!ghLogin) {
        const screenName =
          (result as any)?._tokenResponse?.screenName ||
          (result as any)?.reloadUserInfo?.screenName;
        if (screenName) {
          ghLogin = screenName;
        }
      }

      // 3. Fallback from noreply email: "jay240322@users.noreply.github.com" -> "jay240322"
      if (!ghLogin && result.user.email?.includes("@users.noreply.github.com")) {
        ghLogin = result.user.email.split("@")[0].replace(/^@/, "");
      }

      // 4. Fetch public profile by username if name or avatar is still missing
      if (ghLogin && (!ghProfileName || !ghAvatar)) {
        try {
          const pubProfile = await fetchGitHubUserProfile(ghLogin, false);
          if (pubProfile) {
            if (!ghProfileName && pubProfile.name) ghProfileName = pubProfile.name;
            if (!ghAvatar && pubProfile.avatarUrl) ghAvatar = pubProfile.avatarUrl;
            if (!ghHtmlUrl) ghHtmlUrl = pubProfile.htmlUrl;
            if (ghPublicRepos === undefined) ghPublicRepos = pubProfile.publicRepos;
          }
        } catch {}
      }

      // 5. Clean up display name: NEVER show noreply email!
      let resolvedName = ghProfileName;
      if (!resolvedName || resolvedName.includes("@users.noreply.github.com") || resolvedName.includes("@")) {
        const rawDisplay = result.user.displayName;
        if (rawDisplay && !rawDisplay.includes("@users.noreply.github.com") && !rawDisplay.includes("@")) {
          resolvedName = rawDisplay;
        } else {
          resolvedName = ghLogin || "Developer";
        }
      }

      const finalAvatar = ghAvatar || (ghLogin ? `https://github.com/${ghLogin}.png` : result.user.photoURL);

      return {
        user: {
          uid: result.user.uid,
          email: ghEmail || result.user.email,
          displayName: resolvedName || null,
          photoURL: finalAvatar,
          githubUsername: ghLogin,
          githubProfileUrl: ghHtmlUrl || (ghLogin ? `https://github.com/${ghLogin}` : undefined),
          githubReposCount: ghPublicRepos,
        },
      };
    }

    // Google Provider flow: extract real Google Profile Email, Name & Picture
    const addProfile = additionalInfo?.profile as any;
    let googleEmail =
      result.user.email ||
      result.user.providerData?.find((p: any) => p?.email)?.email ||
      result.user.providerData?.[0]?.email ||
      addProfile?.email ||
      (result as any)?._tokenResponse?.email ||
      (result.user as any)?.reloadUserInfo?.email;

    if (!googleEmail && result.user.uid) {
      googleEmail = `google-${result.user.uid.slice(0, 10)}@secura.security`;
    }

    let googleName = result.user.displayName;
    if (!googleName && addProfile?.name) {
      googleName = addProfile.name;
    }
    if (!googleName && googleEmail && googleEmail.includes("@")) {
      const emailPrefix = googleEmail.split("@")[0];
      googleName = emailPrefix.charAt(0).toUpperCase() + emailPrefix.slice(1);
    }

    let googlePhoto = result.user.photoURL;
    if (!googlePhoto && addProfile?.picture) {
      googlePhoto = addProfile.picture;
    }

    return {
      user: {
        uid: result.user.uid,
        email: googleEmail || null,
        displayName: googleName || "Google User",
        photoURL: googlePhoto,
      },
    };
  }

  throw new Error(
    "Firebase Authentication could not be initialized. Please verify internet connectivity."
  );
}

export async function signInWithEmailAndPassword(
  _auth: any,
  email: string,
  pass: string
): Promise<UserCredential> {
  const live = await getLiveFirebase();
  if (!live) {
    throw new Error("Firebase Authentication is not available.");
  }
  const result = await live.signInWithEmailAndPassword(live.auth, email, pass);
  return {
    user: {
      uid: result.user.uid,
      email: result.user.email,
      displayName: result.user.displayName,
      photoURL: result.user.photoURL,
    },
  };
}

export async function createUserWithEmailAndPassword(
  _auth: any,
  email: string,
  pass: string
): Promise<UserCredential> {
  const live = await getLiveFirebase();
  if (!live) {
    throw new Error("Firebase Authentication is not available.");
  }
  const result = await live.createUserWithEmailAndPassword(live.auth, email, pass);
  return {
    user: {
      uid: result.user.uid,
      email: result.user.email,
      displayName: result.user.displayName,
      photoURL: result.user.photoURL,
    },
  };
}

export async function firebaseSignOut(_auth: any): Promise<void> {
  const live = await getLiveFirebase();
  if (live) {
    await live.signOut(live.auth);
  }
}
