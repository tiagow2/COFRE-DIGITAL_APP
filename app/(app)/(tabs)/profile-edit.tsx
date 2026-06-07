import { SignaturePad, SignaturePreview } from '@/components/DigitalSignature';
import { useAuth } from '@/context/AuthContext';
import { useFinancialTheme } from '@/hooks/useFinancialTheme';
import { profileService } from '@/services/profileService';
import { parseCurrencyInput } from '@/utils/currency';
import { normalizeSignatureValue } from '@/utils/signatureData';
import { Ionicons } from '@expo/vector-icons';
import * as Haptics from 'expo-haptics';
import * as ImagePicker from 'expo-image-picker';
import { useRouter } from 'expo-router';
import React, { useEffect, useState } from 'react';
import {
  Alert,
  Image,
  Modal,
  ScrollView,
  StyleSheet,
  Text,
  TextInput,
  TouchableOpacity,
  View,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';

export default function ProfileEditScreen() {
  const router = useRouter();
  const { user } = useAuth();
  const theme = useFinancialTheme();

  const [city, setCity] = useState('');
  const [income, setIncome] = useState('');
  const [photoUri, setPhotoUri] = useState<string | undefined>();
  const [signature, setSignature] = useState<string | undefined>();
  const [signatureModal, setSignatureModal] = useState(false);
  const [saving, setSaving] = useState(false);
  const [savingSignature, setSavingSignature] = useState(false);

  useEffect(() => {
    if (!user?.uid) return;

    profileService.load(user.uid).then((profile) => {
      if (!profile) return;
      setCity(profile.city);
      setIncome(profile.monthlyIncome > 0 ? String(profile.monthlyIncome).replace('.', ',') : '');
      setPhotoUri(profile.photoUri);
      setSignature(profile.signature ? normalizeSignatureValue(profile.signature) : undefined);
    });
  }, [user?.uid]);

  const pickPhoto = async () => {
    const { status } = await ImagePicker.requestMediaLibraryPermissionsAsync();
    if (status !== 'granted') {
      Alert.alert('Permissão necessária', 'Permita o acesso às suas fotos para escolher uma imagem.');
      return;
    }

    const result = await ImagePicker.launchImageLibraryAsync({
      mediaTypes: ImagePicker.MediaTypeOptions.Images,
      allowsEditing: true,
      aspect: [1, 1],
      quality: 0.55,
      base64: true,
    });

    if (result.canceled || !result.assets[0]) return;
    const asset = result.assets[0];
    if (asset.mimeType && !['image/png', 'image/jpeg', 'image/jpg'].includes(asset.mimeType)) {
      Alert.alert('Imagem inválida', 'Escolha uma imagem PNG, JPG ou JPEG.');
      return;
    }

    setPhotoUri(asset.base64 ? `data:${asset.mimeType || 'image/jpeg'};base64,${asset.base64}` : asset.uri);
  };

  const removePhoto = () => setPhotoUri(undefined);
  const removeSignature = async () => {
    if (!user?.uid) {
      setSignature(undefined);
      return;
    }

    try {
      await profileService.removeSignature(user.uid);
      setSignature(undefined);
      Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
      Alert.alert('Assinatura removida', 'Sua assinatura digital foi removida do perfil.');
    } catch (error) {
      Alert.alert('Erro', (error as Error).message || 'Não foi possível remover a assinatura.');
    }
  };

  const closeSignatureModal = () => {
    setSavingSignature(false);
    setSignatureModal(false);
  };

  const handleSignatureOK = async (sig: string) => {
    if (!user?.uid) {
      setSavingSignature(false);
      Alert.alert('Erro', 'Entre na sua conta antes de salvar a assinatura.');
      return;
    }

    const nextSignature = normalizeSignatureValue(sig);
    if (!nextSignature) {
      setSavingSignature(false);
      Alert.alert('Assinatura vazia', 'Desenhe sua assinatura antes de confirmar.');
      return;
    }

    setSavingSignature(true);
    const monthlyIncome = income.trim() ? parseCurrencyInput(income) : 0;
    try {
      await profileService.save(user.uid, {
        city: city.trim(),
        monthlyIncome: Number.isFinite(monthlyIncome) ? monthlyIncome : 0,
        photoUri,
        signature: nextSignature,
      });
      const savedProfile = await profileService.load(user.uid);
      if (!savedProfile?.signature) {
        throw new Error('A assinatura não foi encontrada depois de salvar.');
      }

      setSignature(normalizeSignatureValue(savedProfile.signature));
      setSignatureModal(false);
      Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
      Alert.alert('Assinatura salva', 'Sua assinatura digital foi salva no seu perfil.');
    } catch (error) {
      Alert.alert('Erro', (error as Error).message || 'Não foi possível salvar a assinatura.');
    } finally {
      setSavingSignature(false);
    }
  };

  const handleSave = async () => {
    if (!user?.uid) return;

    const monthlyIncome = income.trim() ? parseCurrencyInput(income) : 0;
    if (income.trim() && (!Number.isFinite(monthlyIncome) || monthlyIncome < 0)) {
      Alert.alert('Erro', 'Informe uma renda mensal válida.');
      return;
    }

    setSaving(true);
    try {
      await profileService.save(user.uid, {
        city: city.trim(),
        monthlyIncome,
        photoUri,
        signature,
      });
      Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
      Alert.alert('Salvo', 'Perfil atualizado com sucesso.', [{ text: 'OK', onPress: () => router.back() }]);
    } catch (error) {
      Alert.alert('Erro', (error as Error).message || 'Não foi possível salvar o perfil.');
    } finally {
      setSaving(false);
    }
  };

  const initial = (user?.name?.[0] ?? 'U').toUpperCase();

  return (
    <SafeAreaView style={s.safe}>
      <View style={s.header}>
        <TouchableOpacity style={s.backBtn} onPress={() => router.back()}>
          <Ionicons name="arrow-back" size={22} color="#111827" />
        </TouchableOpacity>
        <Text style={s.title} numberOfLines={1}>Editar perfil</Text>
        <View style={{ width: 44 }} />
      </View>

      <ScrollView contentContainerStyle={s.content} showsVerticalScrollIndicator={false}>
        <View style={[s.profileCard, { borderColor: theme.border }]}>
          <TouchableOpacity style={[s.avatar, { backgroundColor: theme.accentSoft }]} onPress={pickPhoto} activeOpacity={0.8}>
            {photoUri ? (
              <Image source={{ uri: photoUri }} style={s.avatarImage} />
            ) : (
              <Text style={[s.avatarTxt, { color: theme.accent }]}>{initial}</Text>
            )}
          </TouchableOpacity>
          <Text style={s.profileName} numberOfLines={1}>{user?.name ?? 'Usuário'}</Text>
          <Text style={s.profileEmail} numberOfLines={1}>{user?.email ?? ''}</Text>
          <View style={s.photoActions}>
            <TouchableOpacity style={[s.smallBtn, { backgroundColor: theme.accent }]} onPress={pickPhoto}>
              <Ionicons name="image-outline" size={15} color="#fff" />
              <Text style={s.smallBtnText}>Trocar foto</Text>
            </TouchableOpacity>
            {photoUri && (
              <TouchableOpacity style={s.smallBtnGhost} onPress={removePhoto}>
                <Ionicons name="trash-outline" size={15} color="#EF4444" />
                <Text style={s.smallBtnGhostText}>Remover</Text>
              </TouchableOpacity>
            )}
          </View>
        </View>

        <View style={s.card}>
          <Text style={s.fieldLabel}>Cidade</Text>
          <TextInput
            style={s.input}
            value={city}
            onChangeText={setCity}
            placeholder="Ex: São Paulo"
            placeholderTextColor="#9CA3AF"
          />

          <Text style={s.fieldLabel}>Renda mensal (R$)</Text>
          <TextInput
            style={s.input}
            value={income}
            onChangeText={setIncome}
            placeholder="0,00"
            placeholderTextColor="#9CA3AF"
            keyboardType="decimal-pad"
          />
        </View>

        <View style={s.card}>
          <View style={s.signatureHeader}>
            <View style={{ flex: 1, minWidth: 0 }}>
              <Text style={s.fieldTitle}>Assinatura digital padrão</Text>
              <Text style={s.fieldHint}>Salva por usuário e usada para confirmar transações de alto valor.</Text>
            </View>
            {signature && (
              <TouchableOpacity onPress={removeSignature} style={s.iconOnlyBtn}>
                <Ionicons name="trash-outline" size={18} color="#EF4444" />
              </TouchableOpacity>
            )}
          </View>

          <TouchableOpacity style={[s.signatureBox, { borderColor: signature ? theme.accent : '#E5E7EB' }]} onPress={() => setSignatureModal(true)} activeOpacity={0.85}>
            {signature ? (
              <SignaturePreview signature={signature} style={s.signatureImage} />
            ) : (
              <View style={s.signatureEmpty}>
                <Ionicons name="create-outline" size={26} color="#9CA3AF" />
                <Text style={s.signatureEmptyText}>Toque para desenhar sua assinatura</Text>
              </View>
            )}
          </TouchableOpacity>
        </View>

        <TouchableOpacity style={[s.saveBtn, { backgroundColor: theme.accent }, saving && { opacity: 0.7 }]} onPress={handleSave} disabled={saving}>
          <Text style={s.saveTxt}>{saving ? 'Salvando...' : 'Salvar alterações'}</Text>
        </TouchableOpacity>
      </ScrollView>

      <Modal visible={signatureModal} animationType="slide" onRequestClose={closeSignatureModal}>
        <SafeAreaView style={s.safe}>
          <View style={s.signatureModalHeader}>
            <View>
              <Text style={s.signatureModalTitle}>Assinatura digital</Text>
              <Text style={s.signatureModalSub}>Desenhe e toque em Salvar para gravar no seu perfil.</Text>
            </View>
            <TouchableOpacity style={s.iconOnlyBtn} onPress={closeSignatureModal}>
              <Ionicons name="close" size={22} color="#111827" />
            </TouchableOpacity>
          </View>
          <View style={s.signatureCanvasWrap}>
            <SignaturePad
              accentColor={theme.accent}
              saving={savingSignature}
              saveLabel="Salvar assinatura"
              savingLabel="Salvando..."
              onSave={handleSignatureOK}
            />
          </View>
        </SafeAreaView>
      </Modal>
    </SafeAreaView>
  );
}

const s = StyleSheet.create({
  safe: { flex: 1, backgroundColor: '#F9FAFB' },
  header: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', gap: 12, paddingHorizontal: 20, paddingTop: 8, paddingBottom: 16 },
  backBtn: { width: 44, height: 44, borderRadius: 22, backgroundColor: '#fff', alignItems: 'center', justifyContent: 'center', borderWidth: 1, borderColor: '#E5E7EB' },
  title: { fontSize: 18, fontWeight: '800', color: '#111827', flex: 1, minWidth: 0, textAlign: 'center' },
  content: { padding: 20, paddingBottom: 96 },
  profileCard: { alignItems: 'center', backgroundColor: '#fff', borderRadius: 24, padding: 22, marginBottom: 18, borderWidth: 1 },
  avatar: { width: 92, height: 92, borderRadius: 46, alignItems: 'center', justifyContent: 'center', marginBottom: 12, overflow: 'hidden' },
  avatarImage: { width: '100%', height: '100%' },
  avatarTxt: { fontSize: 34, fontWeight: '800' },
  profileName: { fontSize: 18, fontWeight: '800', color: '#111827', maxWidth: '100%' },
  profileEmail: { fontSize: 13, color: '#6B7280', marginTop: 4, maxWidth: '100%' },
  photoActions: { flexDirection: 'row', flexWrap: 'wrap', justifyContent: 'center', gap: 8, marginTop: 16 },
  smallBtn: { flexDirection: 'row', alignItems: 'center', gap: 6, paddingHorizontal: 14, paddingVertical: 9, borderRadius: 14 },
  smallBtnText: { color: '#fff', fontWeight: '700', fontSize: 13 },
  smallBtnGhost: { flexDirection: 'row', alignItems: 'center', gap: 6, paddingHorizontal: 14, paddingVertical: 9, borderRadius: 14, backgroundColor: '#FEE2E2' },
  smallBtnGhostText: { color: '#EF4444', fontWeight: '700', fontSize: 13 },
  card: { backgroundColor: '#fff', borderRadius: 20, padding: 18, marginBottom: 18, borderWidth: 1, borderColor: '#F3F4F6' },
  fieldLabel: { fontSize: 13, fontWeight: '700', color: '#374151', marginBottom: 8 },
  fieldTitle: { fontSize: 15, fontWeight: '800', color: '#111827' },
  fieldHint: { fontSize: 12, color: '#6B7280', marginTop: 3 },
  input: { borderWidth: 1, borderColor: '#E5E7EB', borderRadius: 14, padding: 14, fontSize: 15, color: '#111827', backgroundColor: '#F9FAFB', marginBottom: 16 },
  signatureHeader: { flexDirection: 'row', alignItems: 'center', gap: 12, marginBottom: 12 },
  iconOnlyBtn: { width: 40, height: 40, borderRadius: 20, backgroundColor: '#F3F4F6', alignItems: 'center', justifyContent: 'center' },
  signatureBox: { height: 132, borderRadius: 16, borderWidth: 1.5, borderStyle: 'dashed', backgroundColor: '#F9FAFB', overflow: 'hidden' },
  signatureImage: { width: '100%', height: '100%' },
  signatureEmpty: { flex: 1, alignItems: 'center', justifyContent: 'center', padding: 16 },
  signatureEmptyText: { color: '#6B7280', fontWeight: '600', textAlign: 'center', marginTop: 8 },
  saveBtn: { borderRadius: 16, height: 54, alignItems: 'center', justifyContent: 'center' },
  saveTxt: { color: '#fff', fontSize: 16, fontWeight: '800' },
  signatureModalHeader: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', gap: 12, padding: 20 },
  signatureModalTitle: { fontSize: 20, fontWeight: '800', color: '#111827' },
  signatureModalSub: { fontSize: 13, color: '#6B7280', marginTop: 4 },
  signatureCanvasWrap: { flex: 1, marginHorizontal: 16, marginTop: 4, marginBottom: 18 },
});
