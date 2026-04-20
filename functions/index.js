const { onDocumentCreated } = require("firebase-functions/v2/firestore");
const admin = require("firebase-admin");

admin.initializeApp();

/**
 * Triggered when a new memory document is created in a vault.
 * Notifies all vault members except the sender.
 */
exports.notifyOnMemory = onDocumentCreated("vaults/{vaultId}/memories/{memoryId}", async (event) => {
    const { vaultId, memoryId } = event.params;
    console.log("🔥 Function triggered");
    console.log("📦 Vault ID:", vaultId);
    console.log("🧠 Memory ID:", memoryId);

    const memory = event.data.data();
    const snapshot = event.data;

    // VALIDATION 1: Data existence
    if (!memory) {
      console.log("❌ No memory data found");
      return null;
    }
    console.log("✅ Memory data exists");

    // VALIDATION 2: Idempotency & Type
    if (memory.notificationSent) {
      console.log("onMemoryCreated: Notification already sent. Exiting.");
      return null;
    }

    // VALIDATION 3: Members field
    if (!memory.members || memory.members.length === 0) {
      console.log("⚠️ No members found in memory document. Exiting.");
      return null;
    }
    console.log("👥 Members:", JSON.stringify(memory.members));

    const senderId = memory.createdBy?.id;
    const senderName = memory.createdBy?.name || "Someone";

    try {
      // 1. Parallel Fetch Member Documents
      const userDocs = await Promise.all(
        memory.members.map(uid => admin.firestore().collection("users").doc(uid).get())
      );

      // 2. HARDENED FILTER LOGIC
      const now = Date.now();
      const STALE_THRESHOLD = 5 * 60 * 1000;

      let allTokens = [];
      const userStates = [];

      userDocs.forEach(doc => {
        if (!doc.exists) return;
        const data = doc.data();
        
        const isSender = doc.id === senderId;
        const activeVault = data?.activeVault;
        const updatedAt = activeVault?.updatedAt;

        const isFresh =
          updatedAt &&
          updatedAt.toMillis &&
          (now - updatedAt.toMillis() < STALE_THRESHOLD);

        const isInSameVault =
          activeVault?.id === vaultId && isFresh;

        userStates.push({
          userId: doc.id,
          activeVault: activeVault || null,
          isFresh: !!isFresh,
          isInSameVault: !!isInSameVault,
          isSender
        });

        if (!isSender && !isInSameVault) {
          const userTokens = data.expoPushTokens || [];
          allTokens.push(...userTokens);
        }
      });

      console.log("📊 User states:", JSON.stringify(userStates));

      // 3. Deduplicate and Validate Tokens
      const tokens = [...new Set(allTokens)].filter(t => t && t.startsWith("ExponentPushToken"));
      console.log("📲 Final tokens:", JSON.stringify(tokens));

      if (tokens.length === 0) {
        console.log("⚠️ No valid recipients after filtering. Exiting.");
        return null;
      }

      // 4. Send Notifications Individually (Safer Debugging Version)
      const senderName = memory.createdBy?.name || "Someone";
      const caption = memory.caption?.trim();
      const memoryType = memory.type;

      let body = "Tap to view";
      if (memoryType === "text") {
        body = caption || "New memory shared";
      } else if (memoryType === "image") {
        body = caption ? `📸 ${caption}` : "📸 Image shared";
      }

      const title = `New memory shared by ${senderName}`;
      
      await Promise.all(
        tokens.map(async (token) => {
          try {
            const response = await fetch("https://exp.host/--/api/v2/push/send", {
              method: "POST",
              headers: {
                "Content-Type": "application/json",
                "Accept": "application/json",
              },
              body: JSON.stringify({
                to: token,
                sound: "default",
                title: title,
                body: body,
                data: { 
                  vaultId, 
                  memoryId,
                  senderName,
                  memoryCaption: caption || "",
                  memoryType
                },
                priority: "high",
              }),
            });

            const result = await response.json();
            console.log("🚀 Expo response:", JSON.stringify(result));
            
            // Note: In an individual send context, we don't handle auto-cleanup here
            // but the log will reveal if tokens are expired (DeviceNotRegistered).
          } catch (error) {
            console.error("❌ Expo push failed for token:", token, error.message);
          }
        })
      );

      // 5. Finalize: Set idempotency flag
      await snapshot.ref.update({ notificationSent: true });

      return null;
    } catch (error) {
      console.error("onMemoryCreated: Unhandled error in push notification flow:", error);
      return null;
    }
});
