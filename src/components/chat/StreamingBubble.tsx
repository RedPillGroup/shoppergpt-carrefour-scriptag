import { h } from 'preact';
import ReactMarkdown from 'react-markdown';

interface Props {
  text: string;
}

export function StreamingBubble({ text }: Props) {
  return (
    <div class="flex mb-2 md:mb-2.5">
      <div class="flex flex-col w-fit max-w-[86%] md:max-w-[min(78%,42rem)] items-start">
        <span class="block text-[18px] md:text-[20px] mb-2 md:mb-2.5 leading-none font-['Satisfy'] font-normal text-[#C7B287] tracking-[0.02em]">
          Cathia
        </span>
        <div class="inline-block w-fit max-w-full py-2 md:py-2.5 px-3 md:px-3.5 rounded-[4px_16px_16px_16px] md:rounded-[4px_18px_18px_18px] text-[13px] md:text-[13.5px] leading-[1.5] md:leading-[1.55] text-[#1A1A2E] shadow-[0_1px_3px_rgba(0,0,0,.06)] break-words bg-white">
          <div class="[&_p]:m-0 [&_p+p]:mt-2 [&_ul]:list-disc [&_ul]:pl-4 [&_ul]:mt-1 [&_ul]:mb-0 [&_ol]:list-decimal [&_ol]:pl-4 [&_ol]:mt-1 [&_ol]:mb-0 [&_li]:mt-0.5 [&_strong]:font-semibold [&_em]:italic [&_code]:bg-[#F0EDE8] [&_code]:rounded [&_code]:px-1 [&_code]:text-[12px]">
            <ReactMarkdown>{text}</ReactMarkdown>
          </div>
        </div>
      </div>
    </div>
  );
}
