import { Redirect, router, useLocalSearchParams } from 'expo-router';
import { LegalDocumentView } from '../index';
import { useAppState } from '../../src/appState';
import type { LegalDocumentId } from '../../src/legal';

const documentIds: LegalDocumentId[] = ['privacy', 'terms', 'acknowledgements', 'permissions'];

export default function LegalDocumentRoute() {
  const { documentId } = useLocalSearchParams<{ documentId: LegalDocumentId }>();
  const { state } = useAppState();
  if (!state) return null;
  if (!documentIds.includes(documentId)) return <Redirect href="/about" />;
  return <LegalDocumentView language={state.settings.language} documentId={documentId} onBack={() => router.back()} />;
}
