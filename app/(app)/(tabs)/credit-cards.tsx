import { CreditCard, useFinance } from "@/context/FinanceContext";
import { getCardLimitInfo } from "@/utils/cardLimits";
import { parseCurrencyInput } from "@/utils/currency";
import { Ionicons } from "@expo/vector-icons";
import { LinearGradient } from "expo-linear-gradient";
import { useRouter } from "expo-router";
import { useFinancialTheme } from "@/hooks/useFinancialTheme";
import React, { useState } from "react";
import {
  ActivityIndicator,
  Alert,
  FlatList,
  Modal,
  StyleSheet,
  Text,
  TextInput,
  TouchableOpacity,
  View,
  KeyboardAvoidingView,
  Platform,
} from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";

const CARD_COLORS = ["#1565C0", "#6C35DE", "#0F766E", "#111827", "#D97706", "#BE123C"];
const fmt = (v: number) => v.toLocaleString("pt-BR", { style: "currency", currency: "BRL" });

export default function CreditCardsScreen() {
  const router = useRouter();
  const { creditCards, addCreditCard, loadingData } = useFinance();
  const theme = useFinancialTheme();
  const [showAddModal, setShowAddModal] = useState(false);
  const [submitting, setSubmitting] = useState(false);
  const [newCard, setNewCard] = useState({
    name: "",
    lastDigits: "",
    limit: "",
    dueDate: "",
    color: CARD_COLORS[0],
  });

  const handleAddCard = async () => {
    const limit = parseCurrencyInput(newCard.limit);

    if (loadingData) {
      Alert.alert("Aguarde", "Seus dados ainda estao carregando.");
      return;
    }

    if (!newCard.name.trim() || !newCard.lastDigits.trim() || !newCard.limit.trim()) {
      Alert.alert("Erro", "Preencha nome, ultimos 4 digitos e limite.");
      return;
    }

    if (!/^\d{4}$/.test(newCard.lastDigits)) {
      Alert.alert("Erro", "Os ultimos digitos devem ter exatamente 4 numeros.");
      return;
    }

    if (!Number.isFinite(limit) || limit <= 0) {
      Alert.alert("Erro", "Informe um limite valido.");
      return;
    }

    setSubmitting(true);
    try {
      await addCreditCard({
        name: newCard.name.trim(),
        lastDigits: newCard.lastDigits,
        limit,
        used: 0,
        dueDate: newCard.dueDate.trim(),
        color: newCard.color,
      });

      Alert.alert("Sucesso", "Cartao adicionado.");
      setNewCard({
        name: "",
        lastDigits: "",
        limit: "",
        dueDate: "",
        color: CARD_COLORS[0],
      });
      setShowAddModal(false);
    } catch (error) {
      console.error("Error adding card:", error);
      Alert.alert("Erro", (error as Error).message || "Nao foi possivel adicionar o cartao.");
    } finally {
      setSubmitting(false);
    }
  };

  const CardItem = ({ card }: { card: CreditCard }) => {
    const limitInfo = getCardLimitInfo(card);
    const gradient = [card.color || CARD_COLORS[0], "#111827"] as const;

    return (
      <View style={s.cardBlock}>
        <LinearGradient colors={gradient} start={{ x: 0, y: 0 }} end={{ x: 1, y: 1 }} style={s.virtualCard}>
          <View style={s.virtualTop}>
            <View style={{ flex: 1, minWidth: 0 }}>
              <Text style={s.virtualName} numberOfLines={1}>{card.name}</Text>
              <Text style={s.virtualType}>Cartao virtual</Text>
            </View>
            <Ionicons name="wifi-outline" size={22} color="rgba(255,255,255,0.76)" />
          </View>

          <View style={s.chipRow}>
            <View style={s.chip}>
              <View style={s.chipLine} />
              <View style={s.chipLine} />
            </View>
            <Text style={s.cardDigits} numberOfLines={1}>••••  ••••  ••••  {card.lastDigits}</Text>
          </View>

          <View style={s.virtualBottom}>
            <View style={{ flex: 1, minWidth: 0 }}>
              <Text style={s.virtualLabel}>Disponivel</Text>
              <Text style={s.virtualValue} numberOfLines={1} adjustsFontSizeToFit>{fmt(limitInfo.available)}</Text>
            </View>
            <View style={s.duePill}>
              <Text style={s.duePillText} numberOfLines={1}>{card.dueDate ? `Vence ${card.dueDate}` : "Sem venc."}</Text>
            </View>
          </View>
        </LinearGradient>

        <View style={s.usagePanel}>
          <View style={s.usageHeader}>
            <Text style={s.usageTitle}>Uso do limite</Text>
            <View style={s.usageRight}>
              <View style={[s.statusPill, { backgroundColor: limitInfo.softColor }]}>
                <Text style={[s.statusPillText, { color: limitInfo.color }]}>{limitInfo.label}</Text>
              </View>
              <Text style={[s.usagePct, { color: limitInfo.color }]}>{limitInfo.percentage}%</Text>
            </View>
          </View>
          <View style={s.progressBar}>
            <View style={[s.progressFill, { width: `${limitInfo.percentage}%`, backgroundColor: limitInfo.color }]} />
          </View>
          <View style={s.usageFooter}>
            <Text style={s.usageText} numberOfLines={1}>Fatura: {fmt(limitInfo.used)}</Text>
            <Text style={s.usageText} numberOfLines={1}>Livre: {fmt(limitInfo.available)}</Text>
            <Text style={s.usageText} numberOfLines={1}>Limite: {fmt(limitInfo.limit)}</Text>
          </View>
        </View>
      </View>
    );
  };

  return (
    <SafeAreaView style={s.safe}>
      <View style={s.header}>
        <TouchableOpacity style={s.iconBtn} onPress={() => router.back()}>
          <Ionicons name="arrow-back" size={21} color="#111827" />
        </TouchableOpacity>
        <Text style={s.title} numberOfLines={1}>Cartoes</Text>
        <TouchableOpacity style={[s.addBtn, { backgroundColor: theme.accent }]} onPress={() => setShowAddModal(true)}>
          <Ionicons name="add" size={18} color="#fff" />
          <Text style={s.addBtnText}>Novo</Text>
        </TouchableOpacity>
      </View>

      {creditCards.length === 0 ? (
        <View style={s.emptyContainer}>
          <View style={s.emptyIcon}>
            <Ionicons name="card-outline" size={34} color="#1565C0" />
          </View>
          <Text style={s.emptyTitle}>Nenhum cartao ainda</Text>
          <Text style={s.emptyText}>
            Adicione seus cartoes para acompanhar limite, vencimento e uso em um so lugar.
          </Text>
          <TouchableOpacity style={[s.emptyBtn, { backgroundColor: theme.accent }]} onPress={() => setShowAddModal(true)}>
            <Ionicons name="add" size={18} color="#fff" />
            <Text style={s.emptyBtnText}>Adicionar cartao</Text>
          </TouchableOpacity>
        </View>
      ) : (
        <FlatList
          data={creditCards}
          renderItem={({ item }) => <CardItem card={item} />}
          keyExtractor={(item) => item.id}
          contentContainerStyle={s.listContent}
          showsVerticalScrollIndicator={false}
        />
      )}

      <Modal visible={showAddModal} animationType="slide" transparent onRequestClose={() => setShowAddModal(false)}>
        <KeyboardAvoidingView style={s.overlay} behavior={Platform.OS === 'ios' ? 'padding' : 'height'}>
          <TouchableOpacity activeOpacity={1} style={s.sheet}>
            <View style={s.handle} />
            <Text style={s.sheetTitle}>Novo cartao</Text>

            <Text style={s.label}>Nome do cartao</Text>
            <TextInput
              style={s.input}
              value={newCard.name}
              onChangeText={(text) => setNewCard((c) => ({ ...c, name: text }))}
              placeholder="Ex: Nubank, Itau, Inter"
              placeholderTextColor="#9CA3AF"
            />

            <View style={s.twoColumn}>
              <View style={s.fieldColumn}>
                <Text style={s.label}>Ultimos 4 digitos</Text>
                <TextInput
                  style={s.input}
                  value={newCard.lastDigits}
                  onChangeText={(text) => setNewCard((c) => ({ ...c, lastDigits: text.replace(/\D/g, "").slice(0, 4) }))}
                  placeholder="1234"
                  placeholderTextColor="#9CA3AF"
                  keyboardType="numeric"
                  maxLength={4}
                />
              </View>
              <View style={s.fieldColumn}>
                <Text style={s.label}>Vencimento</Text>
                <TextInput
                  style={s.input}
                  value={newCard.dueDate}
                  onChangeText={(text) => setNewCard((c) => ({ ...c, dueDate: text }))}
                  placeholder="10/26"
                  placeholderTextColor="#9CA3AF"
                />
              </View>
            </View>

            <Text style={s.label}>Limite (R$)</Text>
            <TextInput
              style={s.input}
              value={newCard.limit}
              onChangeText={(text) => setNewCard((c) => ({ ...c, limit: text }))}
              placeholder="5000,00"
              placeholderTextColor="#9CA3AF"
              keyboardType="decimal-pad"
            />

            <Text style={s.label}>Cor do cartao</Text>
            <View style={s.swatchRow}>
              {CARD_COLORS.map((color) => (
                <TouchableOpacity
                  key={color}
                  style={[s.swatch, { backgroundColor: color }, newCard.color === color && s.swatchActive]}
                  onPress={() => setNewCard((c) => ({ ...c, color }))}
                  accessibilityLabel={`Selecionar cor ${color}`}
                >
                  {newCard.color === color && <Ionicons name="checkmark" size={16} color="#fff" />}
                </TouchableOpacity>
              ))}
            </View>

            <TouchableOpacity style={[s.submitBtn, { backgroundColor: theme.accent }, (submitting || loadingData) && s.submitBtnDisabled]} onPress={handleAddCard} disabled={submitting || loadingData}>
              {submitting ? <ActivityIndicator color="#fff" /> : <Text style={s.submitBtnText}>Salvar cartao</Text>}
            </TouchableOpacity>
          </TouchableOpacity>
        </KeyboardAvoidingView>
      </Modal>
    </SafeAreaView>
  );
}

const s = StyleSheet.create({
  safe: { flex: 1, backgroundColor: "#F6F7FB" },
  header: {
    paddingHorizontal: 18,
    paddingTop: 12,
    paddingBottom: 18,
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
    gap: 12,
  },
  iconBtn: {
    width: 44,
    height: 44,
    borderRadius: 22,
    backgroundColor: "#fff",
    alignItems: "center",
    justifyContent: "center",
    borderWidth: 1,
    borderColor: "#E5E7EB",
  },
  title: {
    fontSize: 20,
    fontWeight: "800",
    color: "#111827",
    flex: 1,
    minWidth: 0,
    textAlign: "center",
  },
  addBtn: {
    minWidth: 78,
    height: 42,
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    gap: 4,
    backgroundColor: "#1565C0",
    borderRadius: 21,
    paddingHorizontal: 12,
  },
  addBtnText: { color: "#fff", fontWeight: "700", fontSize: 13 },
  listContent: { paddingHorizontal: 18, paddingBottom: 128, gap: 18 },
  cardBlock: {
    gap: 10,
  },
  virtualCard: {
    minHeight: 202,
    borderRadius: 22,
    padding: 20,
    overflow: "hidden",
    shadowColor: "#111827",
    shadowOffset: { width: 0, height: 10 },
    shadowOpacity: 0.18,
    shadowRadius: 18,
    elevation: 6,
  },
  virtualTop: { flexDirection: "row", alignItems: "flex-start", justifyContent: "space-between", gap: 12 },
  virtualName: { color: "#fff", fontSize: 18, fontWeight: "800" },
  virtualType: { color: "rgba(255,255,255,0.68)", fontSize: 12, fontWeight: "600", marginTop: 4 },
  chipRow: { marginTop: 34, flexDirection: "row", alignItems: "center", gap: 14 },
  chip: {
    width: 42,
    height: 32,
    borderRadius: 8,
    backgroundColor: "rgba(255,255,255,0.78)",
    padding: 7,
    justifyContent: "space-between",
  },
  chipLine: { height: 1, backgroundColor: "rgba(17,24,39,0.28)" },
  cardDigits: { flex: 1, minWidth: 0, color: "#fff", fontSize: 16, fontWeight: "700", letterSpacing: 1 },
  virtualBottom: { flexDirection: "row", alignItems: "flex-end", justifyContent: "space-between", gap: 12, marginTop: 30 },
  virtualLabel: { color: "rgba(255,255,255,0.65)", fontSize: 11, fontWeight: "700", textTransform: "uppercase" },
  virtualValue: { color: "#fff", fontSize: 20, fontWeight: "800", marginTop: 4 },
  duePill: {
    maxWidth: 112,
    borderRadius: 999,
    paddingHorizontal: 10,
    paddingVertical: 6,
    backgroundColor: "rgba(255,255,255,0.14)",
  },
  duePillText: { color: "#fff", fontSize: 11, fontWeight: "700" },
  usagePanel: {
    backgroundColor: "#fff",
    borderRadius: 16,
    padding: 14,
    borderWidth: 1,
    borderColor: "#EEF2F7",
  },
  usageHeader: { flexDirection: "row", justifyContent: "space-between", alignItems: "center", gap: 12 },
  usageTitle: { fontSize: 13, color: "#374151", fontWeight: "700" },
  usageRight: { flexDirection: "row", alignItems: "center", gap: 8, flexShrink: 0 },
  statusPill: { borderRadius: 999, paddingHorizontal: 8, paddingVertical: 4 },
  statusPillText: { fontSize: 10, fontWeight: "800" },
  usagePct: { fontSize: 13, fontWeight: "800" },
  progressBar: { height: 8, backgroundColor: "#EEF2F7", borderRadius: 999, overflow: "hidden", marginTop: 10 },
  progressFill: { height: "100%", borderRadius: 999 },
  usageFooter: { flexDirection: "row", flexWrap: "wrap", justifyContent: "space-between", gap: 10, marginTop: 10 },
  usageText: { flexGrow: 1, minWidth: 92, fontSize: 12, color: "#6B7280", fontWeight: "600" },
  emptyContainer: { flex: 1, justifyContent: "center", alignItems: "center", paddingHorizontal: 34 },
  emptyIcon: {
    width: 72,
    height: 72,
    borderRadius: 24,
    backgroundColor: "#EAF2FF",
    alignItems: "center",
    justifyContent: "center",
    marginBottom: 18,
  },
  emptyTitle: { fontSize: 19, fontWeight: "800", color: "#111827", marginBottom: 8, textAlign: "center" },
  emptyText: { fontSize: 14, color: "#6B7280", textAlign: "center", marginBottom: 24, lineHeight: 20 },
  emptyBtn: {
    flexDirection: "row",
    alignItems: "center",
    gap: 6,
    backgroundColor: "#1565C0",
    borderRadius: 18,
    paddingHorizontal: 20,
    paddingVertical: 12,
  },
  emptyBtnText: { color: "#fff", fontWeight: "700" },
  overlay: { flex: 1, backgroundColor: "rgba(17,24,39,0.45)", justifyContent: "flex-end" },
  sheet: {
    backgroundColor: "#fff",
    borderTopLeftRadius: 28,
    borderTopRightRadius: 28,
    padding: 24,
    paddingBottom: 36,
    maxHeight: "92%",
  },
  handle: { width: 40, height: 5, backgroundColor: "#E5E7EB", borderRadius: 3, alignSelf: "center", marginBottom: 18 },
  sheetTitle: { fontSize: 22, fontWeight: "800", marginBottom: 24, color: "#111827", textAlign: "center" },
  label: { fontSize: 14, fontWeight: "700", color: "#374151", marginBottom: 8 },
  input: {
    borderWidth: 1,
    borderColor: "#E5E7EB",
    borderRadius: 16,
    padding: 16,
    fontSize: 16,
    color: "#111827",
    backgroundColor: "#F9FAFB",
    marginBottom: 20,
  },
  twoColumn: { flexDirection: "row", gap: 10 },
  fieldColumn: { flex: 1, minWidth: 0 },
  swatchRow: { flexDirection: "row", gap: 10, marginBottom: 24 },
  swatch: {
    width: 36,
    height: 36,
    borderRadius: 18,
    alignItems: "center",
    justifyContent: "center",
    borderWidth: 2,
    borderColor: "transparent",
  },
  swatchActive: { borderColor: "#111827" },
  submitBtn: {
    backgroundColor: "#111827",
    borderRadius: 18,
    height: 56,
    alignItems: "center",
    justifyContent: "center",
    marginTop: 8,
  },
  submitBtnDisabled: { opacity: 0.6 },
  submitBtnText: { color: "#fff", fontSize: 16, fontWeight: "700" },
});
