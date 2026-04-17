import { View, Text, Pressable } from "react-native";
import type { OutfitCritique as Critique } from "@/lib/types";

type Props = {
  critique: Critique | null;
  loading: boolean;
  error?: string | null;
  onDismiss?: () => void;
  onRetry?: () => void;
};

const ERROR_COPY: Record<string, string> = {
  network: "Connexion perdue pendant l'analyse.",
  image_unreachable: "Impossible d'accéder à la photo.",
  llm_error: "Le styliste est indisponible un instant.",
  llm_refused: "L'analyse n'a pas abouti.",
  schema_mismatch: "Réponse incohérente reçue.",
  no_photo: "Photo manquante pour cette tenue.",
  config_missing: "Service indisponible.",
  previous_failure: "Dernière analyse échouée.",
  empty_response: "Pas de réponse reçue.",
};

export function OutfitCritique({ critique, loading, error, onDismiss, onRetry }: Props) {
  const showFailed = !loading && !critique && error;
  if (!loading && !critique && !error) return null;

  return (
    <View className="bg-paper-100 border-t border-paper-300 px-6 pt-6 pb-8">
      <View className="flex-row justify-between items-center mb-5">
        <Text className="font-body-medium text-micro tracking-widest text-ice">
          NOTES
        </Text>
        {onDismiss && (
          <Pressable onPress={onDismiss} hitSlop={12}>
            <Text className="font-body text-body-sm text-ink-300">Fermer</Text>
          </Pressable>
        )}
      </View>

      {loading || !critique ? (
        showFailed ? (
          <CritiqueFailed error={error!} onRetry={onRetry} />
        ) : (
          <CritiqueSkeleton />
        )
      ) : (
        <CritiqueBody critique={critique} />
      )}
    </View>
  );
}

function CritiqueBody({ critique }: { critique: Critique }) {
  return (
    <View>
      <View className="flex-row items-baseline gap-2 mb-3">
        <Text className="font-display text-h1 tracking-tight text-ink-900">
          {critique.score}
        </Text>
        <Text className="font-body text-body-sm text-ink-300">/ 10</Text>
      </View>

      <Text className="font-display text-h2 tracking-tight text-ink-900 mb-6 leading-snug">
        {critique.verdict}
      </Text>

      {critique.strengths.length > 0 && (
        <View className="mb-5">
          <Text className="font-body-medium text-micro tracking-widest text-ink-300 mb-2">
            POINTS FORTS
          </Text>
          {critique.strengths.map((s, i) => (
            <View key={i} className="flex-row mb-1.5">
              <Text className="font-body text-body-sm text-ice mr-2">•</Text>
              <Text className="font-body text-body-sm text-ink-700 flex-1 leading-6">
                {s}
              </Text>
            </View>
          ))}
        </View>
      )}

      {critique.improvements.length > 0 && (
        <View className="mb-5">
          <Text className="font-body-medium text-micro tracking-widest text-ink-300 mb-2">
            À AFFINER
          </Text>
          {critique.improvements.map((s, i) => (
            <View key={i} className="flex-row mb-1.5">
              <Text className="font-body-medium text-body-sm text-ink-900 mr-2">→</Text>
              <Text className="font-body text-body-sm text-ink-700 flex-1 leading-6">
                {s}
              </Text>
            </View>
          ))}
        </View>
      )}

      {critique.weather_note && (
        <View className="border-l-2 border-ice pl-3 mb-5">
          <Text className="font-body-medium text-micro tracking-widest text-ice mb-1.5">
            MÉTÉO
          </Text>
          <Text className="font-body text-body-sm text-ink-700 leading-6">
            {critique.weather_note}
          </Text>
        </View>
      )}

      {critique.vs_suggestion && (
        <View className="border-t border-paper-300 pt-4">
          <Text className="font-body-medium text-micro tracking-widest text-ink-300 mb-1.5">
            ÉCART AVEC LA PROPOSITION
          </Text>
          <Text className="font-body text-body-sm text-ink-500 italic leading-6">
            {critique.vs_suggestion}
          </Text>
        </View>
      )}
    </View>
  );
}

function CritiqueFailed({ error, onRetry }: { error: string; onRetry?: () => void }) {
  const message = ERROR_COPY[error] ?? "Analyse indisponible pour le moment.";
  return (
    <View>
      <Text className="font-display text-h3 tracking-tight text-ink-900 mb-4 leading-snug">
        {message}
      </Text>
      {onRetry ? (
        <Pressable onPress={onRetry} hitSlop={8}>
          <Text className="font-body-medium text-micro tracking-widest text-ice">
            RETENTER
          </Text>
        </Pressable>
      ) : (
        <Text className="font-body text-body-sm text-ink-300">
          Relance plus tard depuis l'historique.
        </Text>
      )}
    </View>
  );
}

function CritiqueSkeleton() {
  return (
    <View>
      <View className="h-14 w-20 bg-paper-200 mb-4" />
      <View className="h-6 w-3/4 bg-paper-200 mb-2" />
      <View className="h-6 w-1/2 bg-paper-200 mb-6" />
      <View className="h-4 w-24 bg-paper-200 mb-2" />
      <View className="h-4 w-5/6 bg-paper-200 mb-1.5" />
      <View className="h-4 w-2/3 bg-paper-200 mb-4" />
      <Text className="font-body text-body-sm text-ink-300 mt-2">
        Analyse en cours…
      </Text>
    </View>
  );
}
