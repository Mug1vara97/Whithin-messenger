import React, { useMemo } from 'react';
import ReactMarkdown from 'react-markdown';
import remarkGfm from 'remark-gfm';
import remarkBreaks from 'remark-breaks';
import rehypeSanitize from 'rehype-sanitize';
import { openExternalUrl } from '../../../lib/utils/urlHelpers';
import './MessageMarkdown.css';

const MessageMarkdown = ({
  content,
  className = '',
  linkClassName = 'message-link',
  compact = false,
}) => {
  const components = useMemo(
    () => ({
      a: ({ href, children, ...props }) => (
        <a
          href={href}
          className={linkClassName}
          onClick={(e) => {
            e.preventDefault();
            e.stopPropagation();
            if (href) {
              openExternalUrl(href);
            }
          }}
          {...props}
        >
          {children}
        </a>
      ),
    }),
    [linkClassName]
  );

  if (!content || typeof content !== 'string') {
    return null;
  }

  const rootClassName = [
    'message-markdown',
    compact ? 'message-markdown--compact' : '',
    className,
  ]
    .filter(Boolean)
    .join(' ');

  return (
    <div className={rootClassName}>
      <ReactMarkdown
        remarkPlugins={[remarkGfm, remarkBreaks]}
        rehypePlugins={[rehypeSanitize]}
        components={components}
      >
        {content}
      </ReactMarkdown>
    </div>
  );
};

export default MessageMarkdown;
