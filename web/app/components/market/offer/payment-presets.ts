export const paymentPresets = ['50% წინასწარ · 50% მიწოდებისას', '30% წინასწარ · 70% მიწოდებისას', '100% მიწოდებისას', '100% წინასწარ'];
// Exact known aliases only: unknown conditions must keep their full original text.
export function paymentPreset(value: string): string | undefined {
  const text = value.trim().replace(/\s+/g, ' ');
  if (paymentPresets.includes(text)) return text;
  const aliases: Record<string, string> = {
    'წინასწარ': paymentPresets[3], 'მიწოდებისას': paymentPresets[2], '30%–70%': paymentPresets[1],
    '30% ავანსი, 70% მიწოდებისას': paymentPresets[1], '30% ავანსი · 70% მიწოდებისას': paymentPresets[1],
    '30% ავანსი, 70% მიღებისას': paymentPresets[1],
  };
  return aliases[text];
}
