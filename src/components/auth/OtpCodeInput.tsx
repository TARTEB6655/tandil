import React, { useRef, useEffect } from 'react';
import { View, Text, TextInput, StyleSheet, Platform, Pressable } from 'react-native';
import { COLORS, SPACING, BORDER_RADIUS, FONT_SIZES, FONT_WEIGHTS } from '../../constants';

type Props = {
  length: number;
  value: string;
  onChange: (code: string) => void;
  accent: string;
  disabled?: boolean;
};

export function OtpCodeInput({ length, value, onChange, accent, disabled }: Props) {
  const inputRef = useRef<TextInput>(null);
  const digits = value.padEnd(length, ' ').slice(0, length).split('');

  useEffect(() => {
    const t = setTimeout(() => inputRef.current?.focus(), 300);
    return () => clearTimeout(t);
  }, []);

  return (
    <Pressable style={styles.wrap} onPress={() => inputRef.current?.focus()}>
      <View style={styles.boxRow}>
        {digits.map((char, index) => {
          const filled = char.trim().length > 0;
          const focused = index === Math.min(value.length, length - 1);
          return (
            <View
              key={`otp-${index}`}
              style={[
                styles.box,
                filled && { borderColor: accent },
                focused && !filled && { borderColor: accent + '99' },
              ]}
            >
              <Text style={styles.boxText}>{filled ? char : ''}</Text>
            </View>
          );
        })}
      </View>
      <TextInput
        ref={inputRef}
        style={styles.hiddenInput}
        value={value}
        onChangeText={(text) => {
          const digitsOnly = text.replace(/\D/g, '').slice(0, length);
          onChange(digitsOnly);
        }}
        keyboardType="number-pad"
        textContentType="oneTimeCode"
        autoComplete={Platform.OS === 'android' ? 'sms-otp' : 'one-time-code'}
        maxLength={length}
        editable={!disabled}
        caretHidden
      />
    </Pressable>
  );
}

const styles = StyleSheet.create({
  wrap: {
    position: 'relative',
    marginVertical: SPACING.md,
  },
  boxRow: {
    flexDirection: 'row',
    justifyContent: 'center',
    gap: SPACING.sm,
  },
  box: {
    width: 44,
    height: 52,
    borderRadius: BORDER_RADIUS.md,
    borderWidth: 1.5,
    borderColor: COLORS.border,
    backgroundColor: COLORS.surfaceLight,
    alignItems: 'center',
    justifyContent: 'center',
  },
  boxText: {
    fontSize: FONT_SIZES.xl,
    fontWeight: FONT_WEIGHTS.bold,
    color: COLORS.text,
    textAlign: 'center',
    padding: 0,
  },
  hiddenInput: {
    position: 'absolute',
    opacity: 0,
    width: 1,
    height: 1,
  },
});
