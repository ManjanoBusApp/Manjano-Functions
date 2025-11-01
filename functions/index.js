const { initializeApp } = require("firebase-admin/app");
const { getDatabase } = require("firebase-admin/database");
const { getStorage } = require("firebase-admin/storage");
const { onValueWritten } = require("firebase-functions/v2/database");
const stringSimilarity = require("string-similarity");

// ✅ Initialize Firebase Admin SDK once
initializeApp();

function normalizeName(name) {
  return name
    .toLowerCase()
    .replace(/[^a-z\s']/g, "") // keep only letters and spaces
    .replace(/['’]/g, "") // remove apostrophes
    .replace(/\s+/g, " ") // collapse multiple spaces
    .trim()
    .split(" ");
}

function initialsOf(words) {
  return words.map((w) => w[0]).join("");
}

// ✅ Cloud Function to match a child photo automatically
exports.matchChildPhoto = onValueWritten("/children/{childId}", async (event) => {
  try {
    const snapshot = event.data.after;
    const childData = snapshot.val();

    if (!childData || !childData.displayName) {
      console.log(⏭️ Skipped: no displayName or data");
      return null;
    }

    const db = getDatabase();
    const storage = getStorage().bucket("manjano-bus.appspot.com"); // ✅ Correct bucket name

    const [files] = await storage.getFiles({ prefix: "Children Images/" });

    const nameWords = normalizeName(childData.displayName);
    const combinedName = nameWords.join("");
    const reversedName = nameWords.slice().reverse().join("");
    const initials = initialsOf(nameWords);

    let bestMatch = { rating: 0, name: null, url: null };

    for (const file of files) {
      const fileName = file.name.toLowerCase().replace(/[^a-z]/g, "");
      if (!fileName) continue;

      const similarityDirect = stringSimilarity.compareTwoStrings(combinedName, fileName);
      const similarityReversed = stringSimilarity.compareTwoStrings(reversedName, fileName);
      const similarityInitials = stringSimilarity.compareTwoStrings(initials, fileName);

      const similarity = Math.max(similarityDirect, similarityReversed, similarityInitials);

      if (similarity > bestMatch.rating) {
        const url = `https://firebasestorage.googleapis.com/v0/b/manjano-bus.appspot.com/o/${encodeURIComponent(
          file.name
        )}?alt=media`;
        bestMatch = { rating: similarity, name: file.name, url };
      }

      console.log(`# ${file.name} → ${similarity.toFixed(3)}`);
    }

    const THRESHOLD = 0.4;

    if (bestMatch.rating >= THRESHOLD) {
      await db.ref(`/children/${event.params.childId}/photoUrl`).set(bestMatch.url);
      console.log(`✅ Matched "${childData.displayName}" → "${bestMatch.name}" (${bestMatch.rating.toFixed(2)})`);
    } else {
      console.log(`❌ No good match for "${childData.displayName}"`);
    }
  } catch (error) {
    console.error("🔥 Error in matchChildPhoto:", error);
  }

  return null;
});
