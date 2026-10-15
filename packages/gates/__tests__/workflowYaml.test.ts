import { describe, expect, test } from 'bun:test'
import type { WorkflowFile } from '../lib/workflowYaml'
import {
  ancestorsOf,
  executable,
  expandedStepsOf,
  jobOf,
  localAction,
  needsOf,
  stepsOf,
} from '../lib/workflowYaml'

const action: WorkflowFile = {
  path: '.github/actions/build/action.yml',
  doc: { runs: { using: 'composite', steps: [{ run: 'bun run build' }, 'not a step'] } },
}
const workflow: WorkflowFile = {
  path: '.github/workflows/deploy.yml',
  doc: {
    jobs: {
      build: { steps: [{ uses: './.github/actions/build' }, { run: 'echo done' }] },
      deploy: { needs: 'build', steps: [{ uses: 'actions/checkout@v4' }] },
      smoke: { needs: ['deploy', 7] },
      odd: 'not a job',
    },
  },
}

describe('workflowYaml', () => {
  test('stepsOf reads a workflow’s jobs and a composite action’s steps', () => {
    expect(stepsOf(workflow).map((s) => s.where)).toEqual([
      'jobs.build.steps[0]',
      'jobs.build.steps[1]',
      'jobs.deploy.steps[0]',
    ])
    expect(stepsOf(action).map((s) => s.where)).toEqual(['runs.steps[0]'])
  })

  test('localAction resolves only ./.github/actions/ paths among the files', () => {
    expect(localAction([action], './.github/actions/build/')).toBe(action)
    expect(localAction([action], './.github/actions/gone')).toBeUndefined()
    expect(localAction([action], 'actions/checkout@v4')).toBeUndefined()
    expect(localAction([action], undefined)).toBeUndefined()
  })

  test('expandedStepsOf reads through a local action, keeping the calling job', () => {
    const steps = expandedStepsOf([action, workflow], workflow)
    const inner = steps[1]
    expect(inner?.where).toBe(
      'jobs.build.steps[0] > .github/actions/build/action.yml runs.steps[0]'
    )
    expect(inner?.step.run).toBe('bun run build')
    expect(jobOf(inner?.where ?? '')).toBe('build')
    expect(steps).toHaveLength(4)
  })

  test('an action that calls itself is read once', () => {
    const loop: WorkflowFile = {
      path: '.github/actions/loop/action.yml',
      doc: { runs: { steps: [{ uses: './.github/actions/loop' }] } },
    }
    const caller: WorkflowFile = {
      path: 'w.yml',
      doc: { jobs: { j: { steps: [{ uses: './.github/actions/loop' }] } } },
    }
    expect(expandedStepsOf([loop, caller], caller)).toHaveLength(2)
  })

  test('needsOf and ancestorsOf walk the job graph', () => {
    const jobs = workflow.doc.jobs as Record<string, unknown>
    expect(needsOf(jobs.deploy)).toEqual(['build'])
    expect(needsOf(jobs.smoke)).toEqual(['deploy'])
    expect(needsOf(jobs.odd)).toEqual([])
    expect([...ancestorsOf(jobs, 'smoke')].sort()).toEqual(['build', 'deploy'])
  })

  test('executable drops comment lines', () => {
    expect(executable('# exit 1\necho hi\n  # note')).toBe('echo hi')
  })
})
