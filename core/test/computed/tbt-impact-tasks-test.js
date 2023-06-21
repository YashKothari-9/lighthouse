/**
 * @license Copyright 2023 The Lighthouse Authors. All Rights Reserved.
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
    const allSelfImpactTasks = tbtImpactingTasks.filter(t => t.selfTbtImpact === t.tbtImpact);
    expect(noChildTasks).toEqual(allSelfImpactTasks);

    const tbtEstimateFromTasks = tbtImpactingTasks.reduce((sum, t) => sum += t.selfTbtImpact, 0);
    expect(tbtEstimateFromTasks).toMatchInlineSnapshot(`1234`);

    // The total self TBT impact of every task should equal the total TBT impact of just the top level tasks.
    const topLevelTasks = tbtImpactingTasks.filter(t => !t.parent);
    const tbtImpactFromTopLevelTasks = topLevelTasks.reduce((sum, t) => sum += t.tbtImpact, 0);
    expect(tbtImpactFromTopLevelTasks).toBeCloseTo(tbtEstimateFromTasks, 0.1);

    // We use the pessimistic start/end timings to get the TBT impact of each task, so the total TBT impact
    // should be the same as the pessimistic TBT estimate.
    const tbtResult = await TotalBlockingTime.request(metricComputationData, context);
    if ('pessimisticEstimate' in tbtResult) {
      expect(tbtEstimateFromTasks).toBeGreaterThan(tbtResult.timing);
      expect(tbtEstimateFromTasks).toBeCloseTo(tbtResult.pessimisticEstimate.timeInMs, 0.1);
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
    const allSelfImpactTasks = tbtImpactingTasks.filter(t => t.selfTbtImpact === t.tbtImpact);
    expect(noChildTasks).toEqual(allSelfImpactTasks);

    const tbtEstimateFromTasks = tbtImpactingTasks.reduce((sum, t) => sum += t.selfTbtImpact, 0);
    expect(tbtEstimateFromTasks).toMatchInlineSnapshot(`333.0050000000001`);

    // The total self TBT impact of every task should equal the total TBT impact of just the top level tasks.
    const topLevelTasks = tbtImpactingTasks.filter(t => !t.parent);
    const tbtImpactFromTopLevelTasks = topLevelTasks.reduce((sum, t) => sum += t.tbtImpact, 0);
    expect(tbtImpactFromTopLevelTasks).toBeCloseTo(tbtEstimateFromTasks, 0.1);

    // With DT throttling, the TBT estimate from summing all self impacts should
    // be the same as our actual TBT calculation.
    const tbtResult = await TotalBlockingTime.request(metricComputationData, context);
    expect(tbtEstimateFromTasks).toBeCloseTo(tbtResult.timing, 0.1);
  });
});
