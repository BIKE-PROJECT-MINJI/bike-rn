import { StyleSheet, TextInput } from 'react-native';
import { GajaColors } from '../../shared/design/tokens';
import { GajaCard } from '../../shared/ui/GajaCard';

type Props = {
  readonly courseIdInput: string;
  readonly rideRecordIdInput: string;
  readonly partyIdInput: string;
  readonly aiSessionIdInput: string;
  readonly aiCandidateIdInput: string;
  readonly addressQuery: string;
  readonly routePrompt: string;
  readonly betaCode: string;
  readonly onCourseIdChange: (value: string) => void;
  readonly onRideRecordIdChange: (value: string) => void;
  readonly onPartyIdChange: (value: string) => void;
  readonly onAiSessionIdChange: (value: string) => void;
  readonly onAiCandidateIdChange: (value: string) => void;
  readonly onAddressQueryChange: (value: string) => void;
  readonly onRoutePromptChange: (value: string) => void;
  readonly onBetaCodeChange: (value: string) => void;
};

export function ApiTestInputPanel({
  courseIdInput,
  rideRecordIdInput,
  partyIdInput,
  aiSessionIdInput,
  aiCandidateIdInput,
  addressQuery,
  routePrompt,
  betaCode,
  onCourseIdChange,
  onRideRecordIdChange,
  onPartyIdChange,
  onAiSessionIdChange,
  onAiCandidateIdChange,
  onAddressQueryChange,
  onRoutePromptChange,
  onBetaCodeChange,
}: Props) {
  return (
    <GajaCard title="테스트 입력값" subtitle="생성 API 성공 시 관련 ID 입력값은 자동 갱신됩니다.">
      <TextInput value={courseIdInput} onChangeText={onCourseIdChange} keyboardType="number-pad" placeholder="courseId" placeholderTextColor={GajaColors.textMuted} style={styles.input} />
      <TextInput value={rideRecordIdInput} onChangeText={onRideRecordIdChange} keyboardType="number-pad" placeholder="rideRecordId" placeholderTextColor={GajaColors.textMuted} style={styles.input} />
      <TextInput value={partyIdInput} onChangeText={onPartyIdChange} keyboardType="number-pad" placeholder="partyId" placeholderTextColor={GajaColors.textMuted} style={styles.input} />
      <TextInput value={aiSessionIdInput} onChangeText={onAiSessionIdChange} keyboardType="number-pad" placeholder="aiSessionId" placeholderTextColor={GajaColors.textMuted} style={styles.input} />
      <TextInput value={aiCandidateIdInput} onChangeText={onAiCandidateIdChange} keyboardType="number-pad" placeholder="aiCandidateId" placeholderTextColor={GajaColors.textMuted} style={styles.input} />
      <TextInput value={addressQuery} onChangeText={onAddressQueryChange} placeholder="주소/코스 검색어" placeholderTextColor={GajaColors.textMuted} style={styles.input} />
      <TextInput value={routePrompt} onChangeText={onRoutePromptChange} placeholder="AI 코스 조건" placeholderTextColor={GajaColors.textMuted} multiline style={[styles.input, styles.textarea]} />
      <TextInput value={betaCode} onChangeText={onBetaCodeChange} placeholder="베타 초대 코드" placeholderTextColor={GajaColors.textMuted} style={styles.input} />
    </GajaCard>
  );
}

const styles = StyleSheet.create({
  input: {
    backgroundColor: GajaColors.surfaceMuted,
    borderColor: GajaColors.border,
    borderRadius: 14,
    borderWidth: 1,
    color: GajaColors.textPrimary,
    paddingHorizontal: 14,
    paddingVertical: 12,
  },
  textarea: {
    minHeight: 72,
    textAlignVertical: 'top',
  },
});
