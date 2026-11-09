import {
  Alert,
  Linking,
  Platform,
  Pressable,
  StyleSheet,
  Text,
  View,
} from 'react-native';
import { useTranslation } from 'react-i18next';
import type { ActionContent, MaintenanceAction } from './types';

// A trailing line break gives the iOS text renderer room for the final line at accessibility sizes.
function GuidanceText({ text }: { text: string }) {
  return (
    <Text style={styles.body}>
      {text}
      {Platform.OS === 'ios' ? '\n' : ''}
    </Text>
  );
}

export function ActionExplanation({
  action,
  copy,
}: {
  action: MaintenanceAction;
  copy: ActionContent;
}) {
  const { t } = useTranslation();
  return (
    <View style={styles.sections}>
      <View
        style={[
          styles.priority,
          action.priority === 'high' && styles.highPriority,
        ]}
      >
        <Text accessibilityRole="header" style={styles.heading}>
          {t(`maintenance.priority.${action.priority}`)}
        </Text>
        <GuidanceText text={copy.priorityReason} />
        <Text style={styles.hint}>{t('maintenance.priorityHint')}</Text>
      </View>
      <View style={styles.section}>
        <Text accessibilityRole="header" style={styles.heading}>
          {t('why')}
        </Text>
        <GuidanceText text={copy.whyItMatters} />
      </View>
      <View style={styles.section}>
        <Text accessibilityRole="header" style={styles.heading}>
          {t('maintenance.delay')}
        </Text>
        <GuidanceText text={copy.delayConsequences} />
      </View>
      <View style={styles.section}>
        <Text accessibilityRole="header" style={styles.heading}>
          {t('maintenance.care')}
        </Text>
        <GuidanceText
          text={t(`maintenance.safetyLevel.${action.safetyLevel}`)}
        />
        <GuidanceText text={copy.careGuidance} />
      </View>
    </View>
  );
}

export function ActionSources({
  action,
  copy,
}: {
  action: MaintenanceAction;
  copy: ActionContent;
}) {
  const { t } = useTranslation();
  const openSource = async (url: string) => {
    try {
      await Linking.openURL(url);
    } catch {
      Alert.alert(t('maintenance.sources'), t('maintenance.sourceFailed'));
    }
  };
  return (
    <View style={styles.sections}>
      <Text accessibilityRole="header" style={styles.heading}>
        {t('maintenance.sources')}
      </Text>
      <GuidanceText text={t('maintenance.manualPrecedence')} />
      <GuidanceText text={copy.manualNote} />
      <Text style={styles.hint}>{t('maintenance.externalHint')}</Text>
      {action.sources.map((source) => (
        <Pressable
          key={source.url}
          accessibilityRole="link"
          accessibilityLabel={`${source.title} · ${source.publisher}`}
          accessibilityHint={t('maintenance.externalHint')}
          style={styles.link}
          onPress={() => {
            void openSource(source.url);
          }}
        >
          <Text style={styles.linkTitle}>{source.title}</Text>
          <GuidanceText text={source.publisher} />
        </Pressable>
      ))}
    </View>
  );
}

const styles = StyleSheet.create({
  sections: { gap: 12, marginTop: 12 },
  section: { gap: 5 },
  heading: { color: '#17352C', fontSize: 17, fontWeight: '800' },
  body: { color: '#17352C', fontSize: 14, lineHeight: 21 },
  hint: { color: '#4B6258', fontSize: 13, lineHeight: 20 },
  priority: {
    backgroundColor: '#DCEEE4',
    padding: 14,
    borderRadius: 13,
    gap: 5,
  },
  highPriority: { backgroundColor: '#F6EAD0' },
  link: {
    minHeight: 48,
    paddingVertical: 12,
    gap: 4,
    borderBottomWidth: 1,
    borderColor: '#DCE7DF',
  },
  linkTitle: {
    color: '#1F5547',
    fontSize: 14,
    lineHeight: 21,
    textDecorationLine: 'underline',
  },
});
