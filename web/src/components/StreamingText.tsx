import ReactMarkdown from "react-markdown";

interface Props {
  content: string;
}

export function StreamingText({ content }: Props) {
  if (!content) return null;

  return (
    <div className="flex justify-start mb-3">
      <div className="max-w-[85%] rounded-2xl rounded-bl-md bg-neutral-800 px-4 py-2.5 text-sm leading-relaxed">
        <div className="prose prose-invert prose-sm max-w-none [&_pre]:bg-neutral-900 [&_pre]:rounded-lg [&_pre]:p-3 [&_pre]:overflow-x-auto [&_code]:text-emerald-300 [&_code]:text-xs">
          <ReactMarkdown>{content}</ReactMarkdown>
        </div>
        <span className="inline-block w-2 h-4 bg-emerald-400 animate-pulse ml-0.5 align-text-bottom" />
      </div>
    </div>
  );
}
