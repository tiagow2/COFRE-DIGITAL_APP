import { authService } from "./firebase";
import { API_URL } from "./apiConfig";

export const apiService = {
  /**
   * User Profile APIs
   */
  async getUserProfile() {
    try {
      const user = await authService.getCurrentUser();
      if (!user) {
        console.error("GET PROFILE: No user logged in");
        throw new Error("No user logged in");
      }

      console.log("GET PROFILE: Fetching for user:", user.uid);

      const response = await fetch(`${API_URL}/user/profile`, {
        headers: {
          "x-user-id": user.uid,
          "Content-Type": "application/json",
        },
      });

      console.log("GET PROFILE: Response status:", response.status);

      const data = await response.json();
      console.log("GET PROFILE: Response data:", JSON.stringify(data, null, 2));

      if (!response.ok) {
        console.error("GET PROFILE: Failed with status", response.status);
        console.error("GET PROFILE: Error response:", data);
        throw new Error(
          data?.error ||
            `HTTP ${response.status}: Failed to fetch user profile`,
        );
      }

      console.log("✅ GET PROFILE: Success!");
      return data;
    } catch (error: any) {
      console.error("❌ GET PROFILE ERROR:", error.message);
      throw error;
    }
  },

  async updateUserProfile(data: {
    city?: string;
    monthlyIncome?: number;
    initialBalance?: number;
  }) {
    try {
      const user = authService.getCurrentUser();
      
      console.log("UPDATE PROFILE: Starting update");
      console.log("UPDATE PROFILE: Current user from auth service:", user?.uid || "NULL");
      
      if (!user || !user.uid) {
        console.error("❌ UPDATE PROFILE: CRITICAL - No user or uid logged in!");
        console.error("❌ UPDATE PROFILE: user object:", user);
        throw new Error("CRITICAL: No authenticated user. Please login again.");
      }

      console.log("UPDATE PROFILE: User UID confirmed:", user.uid);
      console.log(
        "UPDATE PROFILE: Data to send:",
        JSON.stringify(data, null, 2),
      );

      // Validar dados antes de enviar
      if (
        data.monthlyIncome !== undefined &&
        typeof data.monthlyIncome !== "number"
      ) {
        console.error(
          "UPDATE PROFILE: monthlyIncome is not a number:",
          typeof data.monthlyIncome,
        );
        throw new Error("monthlyIncome must be a number");
      }

      if (
        data.initialBalance !== undefined &&
        typeof data.initialBalance !== "number"
      ) {
        console.error(
          "UPDATE PROFILE: initialBalance is not a number:",
          typeof data.initialBalance,
        );
        throw new Error("initialBalance must be a number");
      }

      const requestBody = JSON.stringify(data);
      console.log("UPDATE PROFILE: Request body:", requestBody);
      console.log("UPDATE PROFILE: API URL:", API_URL);
      console.log("UPDATE PROFILE: X-User-ID header:", user.uid);

      const response = await fetch(`${API_URL}/user/profile`, {
        method: "PUT",
        headers: {
          "x-user-id": user.uid,
          "Content-Type": "application/json",
        },
        body: requestBody,
      });

      console.log("UPDATE PROFILE: Response status:", response.status);
      console.log("UPDATE PROFILE: Response ok:", response.ok);

      const responseData = await response.json();
      console.log(
        "UPDATE PROFILE: Response data:",
        JSON.stringify(responseData, null, 2),
      );

      if (!response.ok) {
        console.error(
          "UPDATE PROFILE: Request failed with status",
          response.status,
        );
        console.error("UPDATE PROFILE: Error response:", responseData);
        throw new Error(
          responseData?.error ||
            `HTTP ${response.status}: Failed to update user profile`,
        );
      }

      console.log("UPDATE PROFILE: Success!", responseData);
      return responseData;
    } catch (error: any) {
      console.error("❌ UPDATE PROFILE ERROR:", error);
      console.error("UPDATE PROFILE: Error message:", error.message);
      console.error("UPDATE PROFILE: Error stack:", error.stack);
      throw error;
    }
  },

  async createUserProfile(data: {
    email: string;
    city?: string;
    monthlyIncome?: number;
    initialBalance?: number;
  }) {
    try {
      const user = await authService.getCurrentUser();
      if (!user) {
        console.error("CREATE PROFILE: No user logged in");
        throw new Error("No user logged in");
      }

      // Validar email
      if (!data.email || typeof data.email !== "string") {
        console.error("CREATE PROFILE: Invalid email:", data.email);
        throw new Error("Email is required and must be a string");
      }

      console.log("CREATE PROFILE: Creating profile for user:", user.uid);
      console.log(
        "CREATE PROFILE: Data to send:",
        JSON.stringify(data, null, 2),
      );

      const requestBody = JSON.stringify(data);

      const response = await fetch(`${API_URL}/user/create-profile`, {
        method: "POST",
        headers: {
          "x-user-id": user.uid,
          "Content-Type": "application/json",
        },
        body: requestBody,
      });

      console.log("CREATE PROFILE: Response status:", response.status);

      const responseData = await response.json();
      console.log(
        "CREATE PROFILE: Response data:",
        JSON.stringify(responseData, null, 2),
      );

      if (!response.ok) {
        console.error("CREATE PROFILE: Failed with status", response.status);
        console.error("CREATE PROFILE: Error response:", responseData);
        throw new Error(
          responseData?.error ||
            `HTTP ${response.status}: Failed to create user profile`,
        );
      }

      console.log("✅ CREATE PROFILE: Success!");
      return responseData;
    } catch (error: any) {
      console.error("❌ CREATE PROFILE ERROR:", error.message);
      throw error;
    }
  },

  /**
   * Credit Card APIs
   */
  async getCreditCards() {
    try {
      const user = await authService.getCurrentUser();
      if (!user) {
        console.error("GET CARDS: No user logged in");
        throw new Error("No user logged in");
      }

      console.log("GET CARDS: Fetching cards for user:", user.uid);

      const response = await fetch(`${API_URL}/credit-cards`, {
        headers: {
          "x-user-id": user.uid,
          "Content-Type": "application/json",
        },
      });

      console.log("GET CARDS: Response status:", response.status);

      const data = await response.json();
      console.log(
        "GET CARDS: Response data count:",
        Array.isArray(data) ? data.length : "N/A",
      );

      if (!response.ok) {
        console.error("GET CARDS: Failed with status", response.status);
        console.error("GET CARDS: Error response:", data);
        throw new Error(
          data?.error ||
            `HTTP ${response.status}: Failed to fetch credit cards`,
        );
      }

      console.log("✅ GET CARDS: Success!");
      return data;
    } catch (error: any) {
      console.error("❌ GET CARDS ERROR:", error.message);
      throw error;
    }
  },

  async createCreditCard(data: {
    name: string;
    lastDigits: string;
    limitAmount: number;
    dueDate?: string;
    color?: string;
  }) {
    try {
      const user = await authService.getCurrentUser();
      if (!user) {
        console.error("CREATE CARD: No user logged in");
        throw new Error("No user logged in");
      }

      // Validar dados
      if (!data.name || typeof data.name !== "string") {
        console.error("CREATE CARD: Invalid name");
        throw new Error("Card name is required");
      }

      if (!data.lastDigits || data.lastDigits.length !== 4) {
        console.error("CREATE CARD: Invalid lastDigits:", data.lastDigits);
        throw new Error("Last 4 digits must be exactly 4 characters");
      }

      if (typeof data.limitAmount !== "number" || data.limitAmount <= 0) {
        console.error("CREATE CARD: Invalid limitAmount:", data.limitAmount);
        throw new Error("Limit amount must be a positive number");
      }

      console.log("CREATE CARD: Creating card for user:", user.uid);
      console.log("CREATE CARD: Data:", {
        name: data.name,
        limitAmount: data.limitAmount,
      });

      const requestBody = JSON.stringify(data);

      const response = await fetch(`${API_URL}/credit-cards`, {
        method: "POST",
        headers: {
          "x-user-id": user.uid,
          "Content-Type": "application/json",
        },
        body: requestBody,
      });

      console.log("CREATE CARD: Response status:", response.status);

      const responseData = await response.json();

      if (!response.ok) {
        console.error("CREATE CARD: Failed with status", response.status);
        console.error("CREATE CARD: Error response:", responseData);
        throw new Error(
          responseData?.error ||
            `HTTP ${response.status}: Failed to create credit card`,
        );
      }

      console.log("✅ CREATE CARD: Success!");
      return responseData;
    } catch (error: any) {
      console.error("❌ CREATE CARD ERROR:", error.message);
      throw error;
    }
  },

  async updateCreditCard(
    cardId: string,
    data: {
      name?: string;
      limitAmount?: number;
      used?: number;
      dueDate?: string;
      color?: string;
    },
  ) {
    try {
      const user = await authService.getCurrentUser();
      if (!user) {
        console.error("UPDATE CARD: No user logged in");
        throw new Error("No user logged in");
      }

      if (!cardId) {
        console.error("UPDATE CARD: No cardId provided");
        throw new Error("Card ID is required");
      }

      console.log("UPDATE CARD: Updating card:", cardId, "for user:", user.uid);
      console.log("UPDATE CARD: Data:", JSON.stringify(data, null, 2));

      const requestBody = JSON.stringify(data);

      const response = await fetch(`${API_URL}/credit-cards/${cardId}`, {
        method: "PUT",
        headers: {
          "x-user-id": user.uid,
          "Content-Type": "application/json",
        },
        body: requestBody,
      });

      console.log("UPDATE CARD: Response status:", response.status);

      const responseData = await response.json();

      if (!response.ok) {
        console.error("UPDATE CARD: Failed with status", response.status);
        console.error("UPDATE CARD: Error response:", responseData);
        throw new Error(
          responseData?.error ||
            `HTTP ${response.status}: Failed to update credit card`,
        );
      }

      console.log("✅ UPDATE CARD: Success!");
      return responseData;
    } catch (error: any) {
      console.error("❌ UPDATE CARD ERROR:", error.message);
      throw error;
    }
  },

  async deleteCreditCard(cardId: string) {
    try {
      const user = await authService.getCurrentUser();
      if (!user) {
        console.error("DELETE CARD: No user logged in");
        throw new Error("No user logged in");
      }

      if (!cardId) {
        console.error("DELETE CARD: No cardId provided");
        throw new Error("Card ID is required");
      }

      console.log("DELETE CARD: Deleting card:", cardId, "for user:", user.uid);

      const response = await fetch(`${API_URL}/credit-cards/${cardId}`, {
        method: "DELETE",
        headers: {
          "x-user-id": user.uid,
          "Content-Type": "application/json",
        },
      });

      console.log("DELETE CARD: Response status:", response.status);

      const responseData = await response.json();

      if (!response.ok) {
        console.error("DELETE CARD: Failed with status", response.status);
        console.error("DELETE CARD: Error response:", responseData);
        throw new Error(
          responseData?.error ||
            `HTTP ${response.status}: Failed to delete credit card`,
        );
      }

      console.log("✅ DELETE CARD: Success!");
      return responseData;
    } catch (error: any) {
      console.error("❌ DELETE CARD ERROR:", error.message);
      throw error;
    }
  },

  /**
   * Mark that user has completed initial onboarding
   */
  async markOnboardingComplete() {
    try {
      const user = authService.getCurrentUser();
      if (!user) {
        console.error('[ONBOARDING] No user logged in');
        throw new Error('No user logged in');
      }

      console.log('[ONBOARDING] Marking onboarding as complete for:', user.uid);

      const response = await fetch(`${API_URL}/user/onboarding-complete`, {
        method: 'POST',
        headers: {
          'x-user-id': user.uid,
          'Content-Type': 'application/json',
        },
      });

      if (!response.ok) {
        const data = await response.json();
        console.error('[ONBOARDING] Failed to mark onboarding complete:', data);
        throw new Error(data?.error || `HTTP ${response.status}`);
      }

      // Salvar também localmente para acesso offline
      const { setItem } = await import('@react-native-async-storage/async-storage').then((m) => m.default);
      await setItem(`onboarding_completed_${user.uid}`, 'true');

      console.log('[ONBOARDING] ✅ Successfully marked onboarding complete');
      return { success: true };
    } catch (error: any) {
      console.error('[ONBOARDING] ❌ Error marking onboarding complete:', error.message);
      throw error;
    }
  },

  /**
   * Check if user has completed onboarding
   */
  async hasCompletedOnboarding(): Promise<boolean> {
    try {
      const user = authService.getCurrentUser();
      if (!user) {
        console.log(
          "[ONBOARDING] hasCompletedOnboarding: No user logged in, returning false",
        );
        return false;
      }

      console.log("[ONBOARDING] Checking onboarding status for:", user.uid);

      const { getItem } =
        await import("@react-native-async-storage/async-storage").then(
          (m) => m.default,
        );

      const completed = await getItem(`onboarding_completed_${user.uid}`);
      const result = completed === "true";

      console.log("[ONBOARDING] Onboarding completed:", result);
      return result;
    } catch (error) {
      console.error("[ONBOARDING] ❌ Error checking onboarding status:", error);
      // Default to false (needs onboarding) on error
      return false;
    }
  },
};
