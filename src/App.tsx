/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import { Sequencer } from './components/Sequencer';

export default function App() {
  return (
    <div className="min-h-screen bg-[#0a0a0a] flex flex-col items-center py-8 md:py-16 px-4">
      <Sequencer />
    </div>
  );
}
