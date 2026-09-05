import Markdown, { type Components } from "react-markdown";
import remarkGfm from "remark-gfm";

const plugins = [remarkGfm];
const components: Components = {
  a: ({ children, href }) => (
    <a href={href} target="_blank" rel="noopener noreferrer">
      {children}
    </a>
  ),
  table: ({ children }) => (
    <div className="max-w-full overflow-x-auto">
      <table>{children}</table>
    </div>
  ),
};

function TaskMarkdown({ source }: { source: string }) {
  return (
    <div className="task-markdown min-w-0 text-sm leading-relaxed text-foreground">
      <Markdown
        remarkPlugins={plugins}
        skipHtml
        components={components}
      >
        {source}
      </Markdown>
    </div>
  );
}

export { TaskMarkdown };
