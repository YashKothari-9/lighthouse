/**
 * @license Copyright 2019 The Lighthouse Authors. All Rights Reserved.
 * Licensed under the Apache License, Version 2.0 (the "License"); you may not use this file except in compliance with the License. You may obtain a copy of the License at http://www.apache.org/licenses/LICENSE-2.0
 * Unless required by applicable law or agreed to in writing, software distributed under the License is distributed on an "AS IS" BASIS, WITHOUT WARRANTIES OR CONDITIONS OF ANY KIND, either express or implied. See the License for the specific language governing permissions and limitations under the License.
 */

import {TotalBlockingTime} from '../../computed/metrics/total-blocking-time.js';
import {TBTImpactTasks} from '../../computed/tbt-impact-tasks.js';
import {defaultSettings} from '../../config/constants.js';
import {getURLArtifactFromDevtoolsLog, readJson} from '../test-utils.js';

const trace = readJson('../fixtures/traces/lcp-m78.json', import.meta);
const devtoolsLog = readJson('../fixtures/traces/lcp-m78.devtools.log.json', import.meta);

describe('TBTImpactTasks', () => {
  /** @type {LH.Config.Settings} */
  let settings;
  /** @type {LH.Artifacts.ComputedContext} */
  let context;

  beforeEach(() => {
    context = {computedCache: new Map()};
    settings = JSON.parse(JSON.stringify(defaultSettings));
  });

  it('works on real artifacts', async () => {
    /** @type {LH.Artifacts.MetricComputationDataInput} */
    const metricComputationData = {
      trace,
      devtoolsLog,
      URL: getURLArtifactFromDevtoolsLog(devtoolsLog),
      gatherContext: {gatherMode: 'navigation'},
      settings,
    };

    const tasks = await TBTImpactTasks.request(metricComputationData, context);

    const tbtImpactingTasks = tasks.filter(t => t.tbtImpact);
    expect(tbtImpactingTasks.length).toMatchInlineSnapshot(`59`);

    // Only tasks with no children should have a `selfTbtImpact` that equals `tbtImpact` if
    // `tbtImpact` is nonzero.
    const noChildTasks = tbtImpactingTasks.filter(t => !t.children.length);
    const noChildImpactTasks = tbtImpactingTasks.filter(t => t.selfTbtImpact === t.tbtImpact);
    expect(noChildTasks).toEqual(noChildImpactTasks);

    const tbtResult = await TotalBlockingTime.request(metricComputationData, context);
    const tbtEstimateFromTasks = tbtImpactingTasks.reduce((sum, t) => sum += t.selfTbtImpact, 0);

    expect(tbtEstimateFromTasks).toMatchInlineSnapshot(`1234`);

    // We use the pessimistic start/end timings to get the TBT impact of each task, so the total TBT impact
    // should be the same as the pessimistic TBT estimate.
    if ('pessimisticEstimate' in tbtResult) {
      expect(tbtEstimateFromTasks).toBeGreaterThan(tbtResult.timing);
      expect(tbtEstimateFromTasks).toBeCloseTo(tbtResult.pessimisticEstimate.timeInMs);
    } else {
      throw new Error('TBT result was not a lantern result');
    }
  });

  it('works on real artifacts with DT throttling', async () => {
    settings.throttlingMethod = 'devtools';

    /** @type {LH.Artifacts.MetricComputationDataInput} */
    const metricComputationData = {
      trace,
      devtoolsLog,
      URL: getURLArtifactFromDevtoolsLog(devtoolsLog),
      gatherContext: {gatherMode: 'navigation'},
      settings,
    };

    const tasks = await TBTImpactTasks.request(metricComputationData, context);

    const tbtImpactingTasks = tasks.filter(t => t.tbtImpact);
    expect(tbtImpactingTasks.length).toMatchInlineSnapshot(`5`);

    // Only tasks with no children should have a `selfTbtImpact` that equals `tbtImpact` if
    // `tbtImpact` is nonzero.
    const noChildTasks = tbtImpactingTasks.filter(t => !t.children.length);
    const noChildImpactTasks = tbtImpactingTasks.filter(t => t.selfTbtImpact === t.tbtImpact);
    expect(noChildTasks).toEqual(noChildImpactTasks);

    const tbtResult = await TotalBlockingTime.request(metricComputationData, context);
    const tbtEstimateFromTasks = tbtImpactingTasks.reduce((sum, t) => sum += t.selfTbtImpact, 0);

    expect(tbtEstimateFromTasks).toMatchInlineSnapshot(`333.0050000000001`);
    expect(tbtEstimateFromTasks).toBeCloseTo(tbtResult.timing);
  });
});
