import { AnyCohortCriteriaType, BehavioralEventType, BehavioralFilterKey, TaxonomicFilterGroupType } from '~/types'

import { cleanBehavioralTypeCriteria, determineFilterType } from './cohortUtils'

describe('determineFilterType', () => {
    it('preserves PersonMetadata across the negation flow', () => {
        const negated = determineFilterType(
            BehavioralFilterKey.PersonMetadata,
            BehavioralEventType.HaveProperty,
            true
        )
        expect(negated.type).toBe(BehavioralFilterKey.PersonMetadata)
    })

    it('still maps regular Person criteria to Person on negation', () => {
        const negated = determineFilterType(BehavioralFilterKey.Person, BehavioralEventType.HaveProperty, true)
        expect(negated.type).toBe(BehavioralFilterKey.Person)
    })
})

describe('cleanBehavioralTypeCriteria', () => {
    // event_type is the transient taxonomic-group hint set when the user first picks a
    // property. It is dropped by later cleanCriteria passes, so the durable `type` must
    // survive on its own once derived.
    it('derives PersonMetadata type from the event_type hint on first selection', () => {
        const criteria: AnyCohortCriteriaType = {
            type: BehavioralFilterKey.Person,
            value: BehavioralEventType.HaveProperty,
            event_type: TaxonomicFilterGroupType.PersonMetadata,
        }
        expect(cleanBehavioralTypeCriteria(criteria).type).toBe(BehavioralFilterKey.PersonMetadata)
    })

    it('does not downgrade a loaded PersonMetadata criterion when event_type is gone', () => {
        const criteria: AnyCohortCriteriaType = {
            type: BehavioralFilterKey.PersonMetadata,
            value: BehavioralEventType.HaveProperty,
            // no event_type — mirrors a cohort loaded from the API
        }
        expect(cleanBehavioralTypeCriteria(criteria).type).toBe(BehavioralFilterKey.PersonMetadata)
    })

    it('maps a plain person property criterion to Person', () => {
        const criteria: AnyCohortCriteriaType = {
            type: BehavioralFilterKey.Person,
            value: BehavioralEventType.HaveProperty,
        }
        expect(cleanBehavioralTypeCriteria(criteria).type).toBe(BehavioralFilterKey.Person)
    })
})
