import { decodeDigitalSignature, encodeDigitalSignature } from '@/utils/signatureData';
import React, { useCallback, useMemo, useRef, useState } from 'react';
import {
  Alert,
  Image,
  LayoutChangeEvent,
  PanResponder,
  StyleProp,
  StyleSheet,
  Text,
  TouchableOpacity,
  View,
  ViewStyle,
} from 'react-native';
import Svg, { Path } from 'react-native-svg';

interface SignaturePreviewProps {
  signature?: string;
  style?: StyleProp<ViewStyle>;
  strokeColor?: string;
}

interface SignaturePadProps {
  accentColor: string;
  saving?: boolean;
  saveLabel?: string;
  savingLabel?: string;
  onSave: (signature: string) => void | Promise<void>;
  style?: StyleProp<ViewStyle>;
}

const pointPattern = /[ML]\s*(-?\d+(?:\.\d+)?)\s+(-?\d+(?:\.\d+)?)/g;

const clamp = (value: number, min: number, max: number) => Math.min(Math.max(value, min), max);

export const pathToPoints = (path: string) => {
  const points: { x: number; y: number }[] = [];
  pointPattern.lastIndex = 0;
  let match = pointPattern.exec(path);

  while (match) {
    points.push({ x: Number(match[1]), y: Number(match[2]) });
    match = pointPattern.exec(path);
  }

  return points;
};

export function SignaturePreview({ signature, style, strokeColor = '#111827' }: SignaturePreviewProps) {
  const stored = decodeDigitalSignature(signature);

  if (!signature) return null;

  if (!stored) {
    return <Image source={{ uri: signature }} style={style as any} resizeMode="contain" />;
  }

  return (
    <View style={[styles.preview, style]}>
      <Svg width="100%" height="100%" viewBox={`0 0 ${stored.width} ${stored.height}`}>
        {stored.paths.map((path, index) => (
          <Path
            key={`${index}-${path.length}`}
            d={path}
            stroke={strokeColor}
            strokeWidth={3.4}
            strokeLinecap="round"
            strokeLinejoin="round"
            fill="none"
          />
        ))}
      </Svg>
    </View>
  );
}

export function SignaturePad({
  accentColor,
  saving = false,
  saveLabel = 'Salvar assinatura',
  savingLabel = 'Salvando...',
  onSave,
  style,
}: SignaturePadProps) {
  const [paths, setPaths] = useState<string[]>([]);
  const [layout, setLayout] = useState({ width: 1, height: 1 });
  const pathsRef = useRef<string[]>([]);
  const lastPointRef = useRef({ x: 0, y: 0 });

  const updatePaths = (nextPaths: string[]) => {
    pathsRef.current = nextPaths;
    setPaths(nextPaths);
  };

  const getPoint = useCallback((event: any) => {
    const x = clamp(Number(event.nativeEvent.locationX) || 0, 0, layout.width);
    const y = clamp(Number(event.nativeEvent.locationY) || 0, 0, layout.height);
    return { x, y };
  }, [layout.height, layout.width]);

  const panResponder = useMemo(
    () =>
      PanResponder.create({
        onStartShouldSetPanResponder: () => true,
        onMoveShouldSetPanResponder: () => true,
        onPanResponderGrant: (event) => {
          const point = getPoint(event);
          lastPointRef.current = point;
          updatePaths([...pathsRef.current, `M ${point.x.toFixed(1)} ${point.y.toFixed(1)}`]);
        },
        onPanResponderMove: (event) => {
          const point = getPoint(event);
          const lastPoint = lastPointRef.current;
          const distance = Math.hypot(point.x - lastPoint.x, point.y - lastPoint.y);
          if (distance < 2) return;

          lastPointRef.current = point;
          const currentPaths = pathsRef.current;
          const lastPath = currentPaths[currentPaths.length - 1];
          if (!lastPath) return;

          updatePaths([
            ...currentPaths.slice(0, -1),
            `${lastPath} L ${point.x.toFixed(1)} ${point.y.toFixed(1)}`,
          ]);
        },
      }),
    [getPoint]
  );

  const handleLayout = (event: LayoutChangeEvent) => {
    const { width, height } = event.nativeEvent.layout;
    setLayout({ width: Math.max(width, 1), height: Math.max(height, 1) });
  };

  const clear = () => updatePaths([]);

  const save = async () => {
    const validPaths = pathsRef.current.filter((path) => pathToPoints(path).length > 1);
    if (validPaths.length === 0) {
      Alert.alert('Assinatura vazia', 'Desenhe sua assinatura antes de confirmar.');
      return;
    }

    await onSave(encodeDigitalSignature(validPaths, layout.width, layout.height));
  };

  return (
    <View style={[styles.pad, style]}>
      <View style={styles.canvas} onLayout={handleLayout} {...panResponder.panHandlers}>
        {paths.length === 0 && (
          <View pointerEvents="none" style={styles.placeholder}>
            <Text style={styles.placeholderText}>Assine aqui</Text>
          </View>
        )}
        <Svg width="100%" height="100%" viewBox={`0 0 ${layout.width} ${layout.height}`}>
          {paths.map((path, index) => (
            <Path
              key={`${index}-${path.length}`}
              d={path}
              stroke="#111827"
              strokeWidth={3.4}
              strokeLinecap="round"
              strokeLinejoin="round"
              fill="none"
            />
          ))}
        </Svg>
      </View>

      <View style={styles.actions}>
        <TouchableOpacity style={styles.clearBtn} onPress={clear} disabled={saving}>
          <Text style={styles.clearTxt}>Limpar</Text>
        </TouchableOpacity>
        <TouchableOpacity
          style={[styles.saveBtn, { backgroundColor: accentColor }, saving && { opacity: 0.7 }]}
          onPress={save}
          disabled={saving}
        >
          <Text style={styles.saveTxt}>{saving ? savingLabel : saveLabel}</Text>
        </TouchableOpacity>
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  preview: { overflow: 'hidden' },
  pad: { flex: 1 },
  canvas: {
    flex: 1,
    minHeight: 260,
    borderRadius: 18,
    borderWidth: 1,
    borderColor: '#E5E7EB',
    backgroundColor: '#fff',
    overflow: 'hidden',
  },
  placeholder: {
    ...StyleSheet.absoluteFillObject,
    alignItems: 'center',
    justifyContent: 'center',
  },
  placeholderText: { color: '#9CA3AF', fontSize: 15, fontWeight: '700' },
  actions: { flexDirection: 'row', gap: 12, paddingTop: 12 },
  clearBtn: {
    flex: 1,
    height: 52,
    borderRadius: 16,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: '#F3F4F6',
  },
  clearTxt: { color: '#374151', fontSize: 15, fontWeight: '800' },
  saveBtn: {
    flex: 1.45,
    height: 52,
    borderRadius: 16,
    alignItems: 'center',
    justifyContent: 'center',
  },
  saveTxt: { color: '#fff', fontSize: 15, fontWeight: '800' },
});
