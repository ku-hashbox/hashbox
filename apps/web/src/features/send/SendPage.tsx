import { useState } from 'react';
import { DEFAULT_EXPIRES, DEFAULT_VIEWS } from '@hashbox/shared';
import type { SendDone, SendOptions, SendPayload, SendTab } from './types';
import TabBar from './TabBar';
import TextInput from './TextInput';
import FileInput from './FileInput';
import OptionsPicker from './OptionsPicker';
import SendResult from './SendResult';
import SendProgress from './SendProgress';
import EnvKeyList from '../env/EnvKeyList';
import { useSend } from './useSend';
import Button from '../../components/Button';
import { MIN_PASSWORD_LENGTH, isPasswordTooShort } from './password';

const DEFAULT_OPTIONS: SendOptions = {
  expiresIn: DEFAULT_EXPIRES,
  maxViews: DEFAULT_VIEWS,
  usePassword: false,
  password: '',
};

/** 보내기 화면 (FE1) */
export default function SendPage() {
  const [tab, setTab] = useState<SendTab>('text');
  const [payload, setPayload] = useState<SendPayload | null>(null);
  const [options, setOptions] = useState<SendOptions>(DEFAULT_OPTIONS);
  const [done, setDone] = useState<SendDone | null>(null);
  /** 파일 탭에 .env 파일을 놓으면 그 내용을 .env 탭으로 넘긴다 */
  const [envSeed, setEnvSeed] = useState('');
  const { send, retryUpload, reset, status } = useSend();

  if (done) {
    return (
      <SendResult
        result={done}
        onReset={() => {
          setDone(null);
          setPayload(null);
          setEnvSeed('');
          setOptions(DEFAULT_OPTIONS); // 이전 비밀번호가 다음 전송에 남지 않게
          reset();
        }}
      />
    );
  }

  const sending =
    status.phase === 'encrypting' || status.phase === 'registering' || status.phase === 'uploading';

  if (sending || status.phase === 'error') {
    return (
      <SendProgress
        status={status}
        hasPassword={options.usePassword}
        onRetry={handleRetry}
        onReset={() => {
          setPayload(null);
          reset();
        }}
      />
    );
  }

  function switchTab(t: SendTab) {
    setTab(t);
    setPayload(null);
    if (t !== 'env') setEnvSeed('');
  }

  async function handleSend() {
    if (!payload) return;
    const d = await send(payload.header, payload.content, options);
    if (d) setDone(d);
  }

  async function handleRetry() {
    const d = status.canRetryUpload ? await retryUpload() : await handleSendReturn();
    if (d) setDone(d);
  }

  async function handleSendReturn(): Promise<SendDone | null> {
    if (!payload) return null;
    return send(payload.header, payload.content, options);
  }

  const pwInvalid = options.usePassword && isPasswordTooShort(options.password);

  return (
    <section className="card send">
      <p className="intro">
        내용은 이 브라우저에서 잠긴 뒤 올라가요. 서버는 열쇠를 모르고, 링크는 정해진 횟수만 열려요.
      </p>
      <TabBar value={tab} onChange={switchTab} />

      {tab === 'text' && <TextInput onPayload={setPayload} />}
      {tab === 'env' && <EnvKeyList onPayload={setPayload} initialText={envSeed} />}
      {tab === 'file' && (
        <FileInput
          onPayload={setPayload}
          onEnvFile={(text) => {
            setEnvSeed(text);
            setTab('env');
            setPayload(null);
          }}
        />
      )}

      <OptionsPicker value={options} onChange={setOptions} />

      <Button variant="primary" disabled={!payload || pwInvalid} onClick={handleSend}>
        링크 만들기
      </Button>
      {!payload && <p className="hint">내용을 입력하면 눌려져요.</p>}
      {payload && pwInvalid && (
        <p className="hint">비밀번호를 {MIN_PASSWORD_LENGTH}자 이상 입력하거나 끄세요.</p>
      )}
    </section>
  );
}
