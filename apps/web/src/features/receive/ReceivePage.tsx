import { useParams } from 'react-router-dom';
import { initialFragment } from '../../lib/fragment';
import { useReceive } from './useReceive';
import StatusMessage from './states/StatusMessage';
import OpenPrompt from './states/OpenPrompt';
import PasswordPrompt from './states/PasswordPrompt';
import TextView from './views/TextView';
import EnvView from './views/EnvView';
import FileView from './views/FileView';

/** 받기 화면 (FE2) */
export default function ReceivePage() {
  const { id = '' } = useParams();
  const { state, open } = useReceive(id, initialFragment);

  switch (state.type) {
    case 'ready':
      return <OpenPrompt meta={state.meta} onOpen={() => open()} />;
    case 'password':
      return <PasswordPrompt attemptsLeft={state.attemptsLeft} onSubmit={(pw) => open(pw)} />;
    case 'opened': {
      const { header, content } = state.result;
      if (header.kind === 'text') return <TextView content={content} />;
      if (header.kind === 'env') return <EnvView content={content} />;
      return <FileView header={header} content={content} />;
    }
    default:
      return <StatusMessage state={state.type} />;
  }
}
