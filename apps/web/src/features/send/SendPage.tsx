import { useState } from 'react';
import { DEFAULT_EXPIRES, DEFAULT_VIEWS } from '@hashbox/shared';
import type { SendDone, SendOptions, SendTab } from './types';
import TabBar from './TabBar';
import TextInput from './TextInput';
import FileInput from './FileInput';
import OptionsPicker from './OptionsPicker';
import SendResult from './SendResult';
import EnvKeyList from '../env/EnvKeyList';

/** 보내기 화면 (FE1) */
export default function SendPage() {
  const [tab, setTab] = useState<SendTab>('text');
  const [options, setOptions] = useState<SendOptions>({
    expiresIn: DEFAULT_EXPIRES,
    maxViews: DEFAULT_VIEWS,
    password: '',
  });
  const [done, setDone] = useState<SendDone | null>(null);

  if (done) return <SendResult result={done} onReset={() => setDone(null)} />;

  return (
    <section>
      <h1>보내기</h1>
      <TabBar value={tab} onChange={setTab} />
      {tab === 'text' && <TextInput />}
      {tab === 'env' && <EnvKeyList />}
      {tab === 'file' && <FileInput />}
      <OptionsPicker value={options} onChange={setOptions} />
      {/* TODO(FE1): 보내기 버튼 → useSend().send → setDone */}
    </section>
  );
}
