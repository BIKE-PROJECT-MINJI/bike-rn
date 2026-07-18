import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { useState } from 'react';
import { StyleSheet, Text, TextInput, View } from 'react-native';
import { loadAuthSession, saveAuthSession } from '../../domain/auth/authSessionStore';
import { loginWithEmail, logoutCurrentSession, registerWithEmail } from '../../domain/auth/authService';
import { GajaColors } from '../../shared/design/tokens';
import { GajaButton } from '../../shared/ui/GajaButton';
import { GajaCard, StatusBadge } from '../../shared/ui/GajaCard';
import { GajaScreen } from '../../shared/ui/GajaScreen';
import { buildProfileSessionSummary } from './profileSessionSummary';

type AuthMode = 'login' | 'register';

export function ProfileScreen() {
  const queryClient = useQueryClient();
  const [authMode, setAuthMode] = useState<AuthMode>('login');
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [displayName, setDisplayName] = useState('');
  const sessionQuery = useQuery({ queryKey: ['auth-session'], queryFn: loadAuthSession });
  const authMutation = useMutation({
    mutationFn: () =>
      authMode === 'register' ? registerWithEmail(email, password, displayName) : loginWithEmail(email, password),
    onSuccess: async (session) => {
      await saveAuthSession(session);
      await queryClient.invalidateQueries({ queryKey: ['auth-session'] });
    },
  });
  const logoutMutation = useMutation({
    mutationFn: logoutCurrentSession,
    onSuccess: async () => {
      resetForm();
      await queryClient.invalidateQueries({ queryKey: ['auth-session'] });
    },
  });
  const canSubmit = email.trim().length > 0 && password.length > 0 && (authMode === 'login' || displayName.trim().length > 0);
  const title = authMode === 'register' ? '계정 만들기' : '로그인';
  const resetForm = () => {
    setAuthMode('login');
    setEmail('');
    setPassword('');
    setDisplayName('');
  };

  if (sessionQuery.data) {
    const session = sessionQuery.data;
    const sessionSummary = buildProfileSessionSummary(session);
    return (
      <GajaScreen>
        <GajaCard title="내 계정" subtitle={sessionSummary.title}>
          <StatusBadge label="로그인됨" tone="success" />
          <View style={styles.stack}>
            <Text style={styles.meta}>{sessionSummary.emailLabel}</Text>
          </View>
          <GajaButton
            label="로그아웃"
            variant="secondary"
            disabled={logoutMutation.isPending}
            onPress={() => logoutMutation.mutate(session.accessToken)}
          />
          {logoutMutation.error ? <Text style={styles.error}>{logoutMutation.error.message}</Text> : null}
        </GajaCard>
      </GajaScreen>
    );
  }

  return (
    <GajaScreen>
      <GajaCard title={title} subtitle="이메일로 로그인하거나 새 계정을 만들 수 있습니다.">
        <View style={styles.modeRow}>
          <GajaButton label="로그인" variant={authMode === 'login' ? 'primary' : 'secondary'} onPress={() => setAuthMode('login')} />
          <GajaButton
            label="회원가입"
            variant={authMode === 'register' ? 'primary' : 'secondary'}
            onPress={() => setAuthMode('register')}
          />
        </View>
        <TextInput
          value={email}
          onChangeText={setEmail}
          placeholder="이메일"
          placeholderTextColor={GajaColors.textMuted}
          autoCapitalize="none"
          keyboardType="email-address"
          style={styles.input}
        />
        <TextInput
          value={password}
          onChangeText={setPassword}
          placeholder="비밀번호"
          placeholderTextColor={GajaColors.textMuted}
          secureTextEntry
          style={styles.input}
        />
        {authMode === 'register' ? (
          <TextInput
            value={displayName}
            onChangeText={setDisplayName}
            placeholder="화면에 표시할 이름"
            placeholderTextColor={GajaColors.textMuted}
            style={styles.input}
          />
        ) : null}
        <GajaButton label={title} onPress={() => authMutation.mutate()} disabled={!canSubmit || authMutation.isPending} />
        {authMutation.error ? <Text style={styles.error}>{authMutation.error.message}</Text> : null}
      </GajaCard>
    </GajaScreen>
  );
}

const styles = StyleSheet.create({
  modeRow: {
    flexDirection: 'row',
    gap: 8,
  },
  stack: {
    gap: 6,
  },
  input: {
    backgroundColor: GajaColors.surfaceMuted,
    borderColor: GajaColors.border,
    borderRadius: 14,
    borderWidth: 1,
    color: GajaColors.textPrimary,
    paddingHorizontal: 14,
    paddingVertical: 12,
  },
  error: {
    color: GajaColors.danger,
    fontSize: 13,
  },
  meta: {
    color: GajaColors.textSecondary,
    fontSize: 13,
  },
});
