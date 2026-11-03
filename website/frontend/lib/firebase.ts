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
    liveGoogle.setCustomParameters({ prompt: "select_account" });

    const liveGithub = new authModule.GithubAuthProvider();
    liveGithub.addScope("read:user");
    liveGithub.addScope("user:email");

    cachedFirebaseInstance = {
      auth: liveAuth,
      googleProvider: liveGoogle,
      githubProvider: liveGithub,
      signInWithPopup: authModule.signInWithPopup,
      signInWithEmailAndPassword: authModule.signInWithEmailAndPassword,
      createUserWithEmailAndPassword: authModule.createUserWithEmailAndPassword,
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
    return {
      login: data.login as string,
      name: (data.name || data.login) as string,
      avatarUrl: (data.avatar_url || "") as string,
      email: (data.email || "") as string,
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

    let ghInfo: { login?: string; htmlUrl?: string; publicRepos?: number } = {};

    if (isGithub) {
      try {
        // Attempt to extract GitHub access token from Firebase credential
        const credential = (result as any)?.credential;
        const token = credential?.accessToken;
        if (token) {
          const profile = await fetchGitHubUserProfile(token, true);
          if (profile) {
            ghInfo = {
              login: profile.login,
              htmlUrl: profile.htmlUrl,
              publicRepos: profile.publicRepos,
            };
          }
        }
      } catch (e) {
        console.warn("Could not fetch extra GitHub OAuth metadata:", e);
      }

      // Fallback screenName if token fetch wasn't available
      if (!ghInfo.login) {
        const screenName =
          (result as any)?._tokenResponse?.screenName ||
          (result as any)?.reloadUserInfo?.screenName;
        if (screenName) {
          ghInfo.login = screenName;
          ghInfo.htmlUrl = `https://github.com/${screenName}`;
        }
      }
    }

    return {
      user: {
        uid: result.user.uid,
        email: result.user.email,
        displayName: result.user.displayName,
        photoURL: result.user.photoURL,
        githubUsername: ghInfo.login,
        githubProfileUrl: ghInfo.htmlUrl,
        githubReposCount: ghInfo.publicRepos,
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
