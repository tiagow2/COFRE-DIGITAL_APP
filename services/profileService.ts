import AsyncStorage from '@react-native-async-storage/async-storage';

export interface LocalProfile {
  city: string;
  monthlyIncome: number;
  photoUri?: string;
  signature?: string;
  updatedAt: string;
}

const keyFor = (userId: string) => `cofre_profile_${userId}`;

export const profileService = {
  async load(userId: string): Promise<LocalProfile | null> {
    const raw = await AsyncStorage.getItem(keyFor(userId));
    if (!raw) return null;

    try {
      return JSON.parse(raw) as LocalProfile;
    } catch {
      return null;
    }
  },

  async save(userId: string, data: Partial<LocalProfile>): Promise<LocalProfile> {
    const current = await this.load(userId);
    const hasPhoto = Object.prototype.hasOwnProperty.call(data, 'photoUri');
    const hasSignature = Object.prototype.hasOwnProperty.call(data, 'signature');
    const next: LocalProfile = {
      city: data.city ?? current?.city ?? '',
      monthlyIncome: data.monthlyIncome ?? current?.monthlyIncome ?? 0,
      photoUri: hasPhoto ? data.photoUri : current?.photoUri,
      signature: hasSignature ? data.signature : current?.signature,
      updatedAt: new Date().toISOString(),
    };

    await AsyncStorage.setItem(keyFor(userId), JSON.stringify(next));
    return next;
  },

  async removePhoto(userId: string): Promise<LocalProfile> {
    const current = await this.load(userId);
    const next: LocalProfile = {
      city: current?.city ?? '',
      monthlyIncome: current?.monthlyIncome ?? 0,
      signature: current?.signature,
      updatedAt: new Date().toISOString(),
    };
    await AsyncStorage.setItem(keyFor(userId), JSON.stringify(next));
    return next;
  },

  async removeSignature(userId: string): Promise<LocalProfile> {
    const current = await this.load(userId);
    const next: LocalProfile = {
      city: current?.city ?? '',
      monthlyIncome: current?.monthlyIncome ?? 0,
      photoUri: current?.photoUri,
      updatedAt: new Date().toISOString(),
    };
    await AsyncStorage.setItem(keyFor(userId), JSON.stringify(next));
    return next;
  },
};
