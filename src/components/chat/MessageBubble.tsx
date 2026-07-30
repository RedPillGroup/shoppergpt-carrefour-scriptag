import { h } from 'preact';
import ReactMarkdown from 'react-markdown';
import remarkBreaks from 'remark-breaks';
import { motion, useReducedMotion } from 'framer-motion';
import { Message } from '../../types';
import { StepToggleCard } from './StepToggleCard';
import { StoreSelectionCard } from './StoreSelectionCard';
import { ModeSelectionCard } from './ModeSelectionCard';

interface Props {
  message: Message;
  showSender?: boolean;
  fadeInOnMount?: boolean;
  fadeInDelay?: number;
  /** Forwarded to StepToggleCard — tracks the live step selection so it rides with
   * the user's NEXT chat message (no submit button; see getClientState). */
  onStepSelectionChange?: (steps: string[]) => void;
  /** Freezes the step-toggle card once the conversation has moved past it (i.e. this
   * isn't the latest message anymore) — kept visible (chat history stays readable)
   * but no longer interactive, since editing it wouldn't do anything at that point. */
  stepSelectionDisabled?: boolean;
  /** "Valider" button on the step-toggle card — sends the current selection as a
   * chat message right away instead of waiting for the user to type something. */
  onValidateSteps?: () => void;
  /** Forwarded to StoreSelectionCard/ModeSelectionCard — a click sends the pick as a
   * normal chat message immediately (quick-reply style, no deferred sync). */
  onSelectStore?: (storeName: string) => void;
  onSelectMode?: (modeLabel: string) => void;
  /** Freezes the store/mode cards once a newer message exists — unlike the step
   * card, a click here sends immediately, so there's no window to keep it live. */
  choiceCardsDisabled?: boolean;
}

export function MessageBubble({
  message,
  showSender,
  fadeInOnMount = false,
  fadeInDelay = 0,
  onStepSelectionChange,
  stepSelectionDisabled = false,
  onValidateSteps,
  onSelectStore,
  onSelectMode,
  choiceCardsDisabled = false
}: Props) {
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
          ? { duration: 0.5, delay: fadeInDelay, ease: [0.16, 1, 0.3, 1] }
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
            <div class="[&_p]:m-0 [&_p+p]:mt-3 [&_ul]:list-disc [&_ul]:pl-4 [&_ul]:mt-2 [&_ul]:mb-0 [&_ul+p]:mt-3 [&_ol]:list-decimal [&_ol]:pl-4 [&_ol]:mt-2 [&_ol]:mb-0 [&_ol+p]:mt-3 [&_li]:mt-1 [&_strong]:font-semibold [&_em]:italic [&_code]:bg-[#F0EDE8] [&_code]:rounded [&_code]:px-1 [&_code]:text-[12px]">
              <ReactMarkdown remarkPlugins={[remarkBreaks]}>{message.content}</ReactMarkdown>
            </div>
          )}
        </div>
        {!isUser && message.stepSuggestion && onStepSelectionChange && (
          <StepToggleCard
            items={message.stepSuggestion}
            onChange={onStepSelectionChange}
            disabled={stepSelectionDisabled}
            onValidate={onValidateSteps}
          />
        )}
        {!isUser && message.storeOptions && onSelectStore && (
          <StoreSelectionCard
            items={message.storeOptions}
            onSelect={onSelectStore}
            disabled={choiceCardsDisabled}
          />
        )}
        {!isUser && message.modeOptions && onSelectMode && (
          <ModeSelectionCard
            item={message.modeOptions}
            onSelect={onSelectMode}
            disabled={choiceCardsDisabled}
          />
        )}
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
