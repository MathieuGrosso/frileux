import { Text } from "react-native";

interface MessageBodyProps {
  body: string;
}

export function MessageBody({ body }: MessageBodyProps) {
  const parts = body.split(/(@[a-zA-Z0-9_.-]+)/g);
  return (
    <Text className="font-body text-ink-900 text-[14px] leading-[20px]">
      {parts.map((part, i) =>
        part.startsWith("@") ? (
          <Text key={i} className="font-body-semibold text-ice-600">
            {part}
          </Text>
        ) : (
          <Text key={i}>{part}</Text>
        ),
      )}
    </Text>
  );
}
