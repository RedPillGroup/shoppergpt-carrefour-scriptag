import { h } from 'preact';
import ReactMarkdown from 'react-markdown';
import { motion, useReducedMotion } from 'framer-motion';
import { Message } from '../../../types';

interface MessageBubbleProps {
  message: Message;
  showSender?: boolean;
  fadeInOnMount?: boolean;
  fadeInDelay?: number;
}

export function MessageBubble({
  message,
  showSender,
  fadeInOnMount = false,
  fadeInDelay = 0
}: MessageBubbleProps) {
  const isUser = message.role === 'user';
  const shouldReduceMotion = useReducedMotion();
  return (
    <motion.div
      class={`flex mb-2 md:mb-2.5 ${isUser ? 'justify-end' : ''}`}
      initial={
        fadeInOnMount && !shouldReduceMotion ? { opacity: 0, y: 8, scale: 0.998 } : undefined
      }
      animate={fadeInOnMount && !shouldReduceMotion ? { opacity: 1, y: 0, scale: 1 } : undefined}
      transition={
        fadeInOnMount && !shouldReduceMotion
          ? {
              duration: 0.5,
              delay: fadeInDelay,
              ease: [0.16, 1, 0.3, 1]
            }
          : undefined
      }
    >
      <div
        class={`flex flex-col w-fit max-w-[86%] md:max-w-[min(78%,42rem)] ${isUser ? 'items-end' : 'items-start'}`}
      >
        {!isUser && showSender && (
          <span class="block text-[18px] md:text-[20px] mb-2 md:mb-2.5 leading-none font-['Satisfy'] font-normal text-[#C7B287] tracking-[0.02em]">
            Cathia
          </span>
        )}
        <div
          class={`inline-block w-fit max-w-full py-2 px-3 md:py-2.5 md:px-3.5 rounded-[16px] md:rounded-[18px] text-[13px] md:text-[13.5px] leading-[1.5] md:leading-[1.55] shadow-[0_1px_3px_rgba(0,0,0,.06)] break-words ${
            isUser
              ? 'bg-[#E8E4DE] text-[#1A1A2E] rounded-tr-[4px]'
              : 'bg-white text-[#1A1A2E] rounded-tl-[4px]'
          }`}
        >
          {isUser ? (
            <span>{message.content}</span>
          ) : (
            <ReactMarkdown>{message.content}</ReactMarkdown>
          )}
        </div>
        <div
          class={`text-[10px] md:text-[11px] text-[#6B7280] mt-1.5 md:mt-2 px-1 ${isUser ? 'text-right' : ''}`}
        >
          {message.timestamp.toLocaleTimeString('fr-FR', {
            hour: '2-digit',
            minute: '2-digit'
          })}
        </div>
      </div>
    </motion.div>
  );
}

export function TypingIndicator() {
  return (
    <div class="flex mb-2 md:mb-2.5">
      <div class="flex flex-col w-fit max-w-[86%] md:max-w-[min(78%,42rem)] items-start">
        <span class="block text-[18px] md:text-[20px] mb-2 md:mb-2.5 leading-none font-['Satisfy'] font-normal text-[#C7B287] tracking-[0.02em]">
          Cathia
        </span>
        <div class="bg-white w-fit max-w-full py-2.5 md:py-3 px-3.5 md:px-4 rounded-[4px_16px_16px_16px] md:rounded-[4px_18px_18px_18px] flex gap-1 md:gap-[5px] items-center shadow-[0_1px_3px_rgba(0,0,0,.06)]">
          <div
            class="w-1.5 h-1.5 md:w-[7px] md:h-[7px] bg-[#c4b9a8] rounded-full animate-bounce"
            style={{ animationDelay: '0s', animationDuration: '1.2s' }}
          />
          <div
            class="w-1.5 h-1.5 md:w-[7px] md:h-[7px] bg-[#c4b9a8] rounded-full animate-bounce"
            style={{ animationDelay: '.2s', animationDuration: '1.2s' }}
          />
          <div
            class="w-1.5 h-1.5 md:w-[7px] md:h-[7px] bg-[#c4b9a8] rounded-full animate-bounce"
            style={{ animationDelay: '.4s', animationDuration: '1.2s' }}
          />
        </div>
      </div>
    </div>
  );
}

interface StreamingBubbleProps {
  text: string;
}

export function StreamingBubble({ text }: StreamingBubbleProps) {
  return (
    <div class="flex mb-2 md:mb-2.5">
      <div class="flex flex-col w-fit max-w-[86%] md:max-w-[min(78%,42rem)] items-start">
        <span class="block text-[18px] md:text-[20px] mb-2 md:mb-2.5 leading-none font-['Satisfy'] font-normal text-[#C7B287] tracking-[0.02em]">
          Cathia
        </span>
        <div class="inline-block w-fit max-w-full py-2 md:py-2.5 px-3 md:px-3.5 rounded-[4px_16px_16px_16px] md:rounded-[4px_18px_18px_18px] text-[13px] md:text-[13.5px] leading-[1.5] md:leading-[1.55] text-[#1A1A2E] shadow-[0_1px_3px_rgba(0,0,0,.06)] break-words bg-white">
          <ReactMarkdown>{text}</ReactMarkdown>
        </div>
      </div>
    </div>
  );
}
