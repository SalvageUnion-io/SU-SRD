#!/usr/bin/env bun
/**
 * Unified validation runner for all validation scripts
 * Usage:
 *   bun run tools/validate.ts          # Run all validators
 *   bun run tools/validate.ts ids      # Run only ID validation
 *   bun run tools/validate.ts refs     # Run only reference validation
 *   bun run tools/validate.ts actions  # Run only action validation
 *   bun run tools/validate.ts all      # Run all validators (same as no arg)
 */

const validators = {
  ids: async () => {
    const { default: checkUniqueIds } = await import('./validators/uniqueIds.js')
    return checkUniqueIds()
  },
  refs: async () => {
    const { default: validateReferences } = await import('./validators/references.js')
    return validateReferences()
  },
  actions: async () => {
    const { default: validateActionReferences } = await import('./validators/actionReferences.js')
    return validateActionReferences()
  },
  generated: async () => {
    const { default: validateGenerated } = await import('./validators/generated.js')
    return validateGenerated()
  },
}

async function main() {
  const mode = Bun.argv[2] || 'all'

  if (mode === 'all') {
    console.log('🔍 Running all validators...\n')
    let allPassed = true

    for (const [name, validator] of Object.entries(validators)) {
      console.log(`\n${'='.repeat(80)}`)
      console.log(`Running validator: ${name}`)
      console.log('='.repeat(80))
      try {
        const result = await validator()
        // Validators return 0 for success, 1 for failure, or true/false
        // Handle both number and boolean return types
        if (typeof result === 'number') {
          if (result !== 0) allPassed = false
        } else if (result === false) {
          allPassed = false
        }
      } catch (error) {
        console.error(`❌ Validator ${name} failed:`, error)
        allPassed = false
      }
    }

    if (allPassed) {
      console.log('\n✅ All validators passed!')
      process.exit(0)
    } else {
      console.log('\n❌ Some validators failed!')
      process.exit(1)
    }
  } else {
    const validator = validators[mode as keyof typeof validators]
    if (!validator) {
      console.error(`❌ Unknown validator: ${mode}`)
      console.error(`Available validators: ${Object.keys(validators).join(', ')}, all`)
      process.exit(1)
    }

    try {
      const result = await validator()
      // Validators return 0 for success, 1 for failure, or true/false
      let exitCode = 1
      if (typeof result === 'number') {
        exitCode = result === 0 ? 0 : 1
      } else if (result === true) {
        exitCode = 0
      } else if (result === false) {
        exitCode = 1
      }
      process.exit(exitCode)
    } catch (error) {
      console.error(`❌ Validator ${mode} failed:`, error)
      process.exit(1)
    }
  }
}

main()
