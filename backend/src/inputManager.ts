export interface UserInputData {
    inputs: { [key: string]: string };
    selectedButtonId?: string;
}

// Store pending input resolvers: testId -> resolve function
const pendingInputs = new Map<string, (data: UserInputData) => void>();

// Store cached inputs: testId -> { desktop?: UserInputData, mobile?: UserInputData }
const inputCache = new Map<string, { desktop?: UserInputData, mobile?: UserInputData }>();

// Store recently resolved IDs to handle duplicate requests gracefully (idempotency)
// This prevents 404/failure errors if the frontend or network sends the submit request twice.
const recentlyResolved = new Set<string>();

const instanceId = Math.floor(Math.random() * 10000);
console.log(`[InputManager ${instanceId}] 🔄 Module loaded.`);

export function registerInputResolver(testId: string, resolve: (data: UserInputData) => void) {
    console.log(`[InputManager ${instanceId}] 📥 Registering resolver for testId: ${testId}`);
    pendingInputs.set(testId, resolve);
}

export function resolveInputRequest(testId: string, data: UserInputData): boolean {
    console.log(`[InputManager ${instanceId}] 📤 Resolving request for testId: ${testId}`);

    const resolve = pendingInputs.get(testId);
    if (resolve) {
        resolve(data);
        pendingInputs.delete(testId);

        // Mark as recently resolved
        recentlyResolved.add(testId);
        console.log(`[InputManager ${instanceId}] 🆕 Added ${testId} to recentlyResolved. Set Size: ${recentlyResolved.size}`);

        // Clear from recently resolved set after 10 seconds
        setTimeout(() => {
            recentlyResolved.delete(testId);
            console.log(`[InputManager ${instanceId}] 🗑️ Removed ${testId} from recentlyResolved (timeout)`);
        }, 10000);

        return true;
    }

    // Check if it was just resolved (duplicate request)
    if (recentlyResolved.has(testId)) {
        console.log(`[InputManager ${instanceId}] ⚠️ Duplicate request for ${testId} detected. In recentlyResolved? YES. Returning success.`);
        return true;
    } else {
        console.log(`[InputManager ${instanceId}] ❓ Duplicate check failed. ${testId} NOT in recentlyResolved. Keys: ${Array.from(recentlyResolved.keys()).join(', ')}`);
    }

    console.warn(`[InputManager ${instanceId}] ❌ No pending resolver found for testId: ${testId}`);
    return false;
}

export function cacheInput(testId: string, category: 'desktop' | 'mobile', data: UserInputData) {
    const current = inputCache.get(testId) || {};
    current[category] = data;
    inputCache.set(testId, current);
    console.log(`[InputManager ${instanceId}] 💾 Cached inputs for ${testId} (${category})`);
}

export function getCachedInput(testId: string, category: 'desktop' | 'mobile'): UserInputData | undefined {
    const cached = inputCache.get(testId);
    const result = cached ? cached[category] : undefined;
    if (result) {
        console.log(`[InputManager ${instanceId}] 🎯 Cache HIT for ${testId} (${category})`);
    } else {
        console.log(`[InputManager ${instanceId}] 💨 Cache MISS for ${testId} (${category})`);
    }
    return result;
}
