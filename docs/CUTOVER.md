# L2 Dashboard Cutover to Trading Cockpit

This document outlines the procedures for cutting over from the legacy L2Dashboard to the new TradingCockpit interface, including rollback mechanisms and cleanup steps.

## Overview

The cutover process switches the default interface from the legacy dashboard (`react-grid-layout` based) to the new TradingCockpit (`react-resizable-panels` based) interface. The transition uses environment flags to maintain 1-minute rollback capability.

## Pre-Cutover Checklist

### Environment Verification
- [ ] All [M0-M7] tickets completed and verified working
- [ ] Legacy dashboard fully functional as baseline
- [ ] TradingCockpit tested in `/cockpit` route with full functionality
- [ ] Feature flags properly configured:
  - `USE_LEGACY=false` (default behavior)
  - `DISABLE_LEGACY_DASHBOARD=false` (legacy still accessible)

### Functionality Verification
- [ ] TradingCockpit components all render without errors
- [ ] Cockpit store state management working
- [ ] Analytics dashboard layouts persist correctly
- [ ] Real-time SSE streams display properly
- [ ] Hotkeys (Ctrl+K, Ctrl+F, R, F1) functional
- [ ] Guardrail badges and bottom logs operational

### User Communication
- [ ] Team notified of upcoming cutover maintenance window
- [ ] Known issues documented and communicated
- [ ] Rollback procedures shared with stakeholders

## Cutover Procedure

### Step 1: Environment Configuration
Update `.env` file to enable cutover:

```bash
# Set to true to disable legacy dashboard access completely
DISABLE_LEGACY_DASHBOARD=true

# This should remain false (default)
USE_LEGACY=false
```

### Step 2: Application Restart
Restart the application:

```bash
# For development
npm run dev

# For production (Docker)
docker compose down
docker compose up -d

# Verify via Makefile
make health
```

### Step 3: Verification
- [ ] Root path `/` now shows TradingCockpit
- [ ] No legacy dashboard components are accessible
- [ ] All TradingCockpit functionality works as expected
- [ ] Analytics panels display live data correctly

### Step 4: User Notification
Notify users of successful cutover and provide guidance on rollback procedures if needed.

## Rollback Procedure (1-Minute Rollback)

If issues arise post-cutover, rollback can be performed in <1 minute:

### Immediate Rollback (Uses USE_LEGACY flag)
```bash
# In .env, set USE_LEGACY=true while keeping DISABLE_LEGACY_DASHBOARD=true
USE_LEGACY=true
DISABLE_LEGACY_DASHBOARD=true  # Keep true to prevent accidental re-enablement
```

This restores legacy dashboard access via the root path while maintaining production cutover state.

### Full Rollback (Revert to Pre-Cutover)
```bash
# Restore original configuration
DISABLE_LEGACY_DASHBOARD=false
USE_LEGACY=false  # Or true if reverting to legacy default
```

### Rollback Verification
- [ ] Restart application and verify legacy dashboard loads
- [ ] Confirm all historical settings/layouts persist
- [ ] Test critical trading workflows

## Post-Cutover Cleanup

### After 24 Hours of Stable Operation
The following cleanup can be performed to finalize the transition:

### Code Cleanup
Remove legacy dashboard dependencies:

```bash
# Check for unused dependencies (run after cutover verification)
pnpm depcheck || npm run depcheck

# Remove react-grid-layout if no longer used
npm uninstall react-grid-layout

# Remove legacy dashboard files/compoonents after 2-week grace period
# (AFTER ops sign-off)
```

### File Removal
Mark for deletion after 2-week grace period:
- `src/components/L2Dashboard.tsx`
- Legacy-specific dashboard components
- `src/app/globals.css` legacy grid styles prefixed with `.legacy-dashboard`

### Environment Cleanup
Update `.env.example` to reflect new defaults:
- Set `DISABLE_LEGACY_DASHBOARD=true` as new default
- Remove references to `USE_LEGACY` from production examples

## Monitoring & Alerts

### Performance Metrics
Monitor these metrics post-cutover:
- Cockpit render time <50fps target
- SSE reconnection <3s
- Memory usage stability
- Component re-render rates

### Issue Response
- Set up error tracking for post-cutover issues
- Establish call-home for cutover success metrics
- Monitor user-reported issues via ops channels

## Risk Mitigation

### Feature Parity Check
Before cutover, ensure:
- TradingCockpit has all critical features from legacy dashboard
- Keyboard navigation fully functional
- Accessibility not degraded
- Performance equal or better than legacy

### Gradual Rollout Option
For high-risk deployments:
1. Use layered feature flags to control user exposure
2. Monitor error rates and user feedback
3. Implement percentage-based rollout (50% → 100%)

### Backup Verification
- [ ] Database backups current and restorable
- [ ] Configuration backups verified
- [ ] Session layouts backed up

## Operations Checklist

### Daily (First Week Post-Cutover)
- [ ] Review application logs for new errors
- [ ] Monitor user feedback channels
- [ ] Verify all trading sessions complete successfully
- [ ] Check performance metrics against baselines

### Weekly (First Month)
- [ ] Performance trend analysis
- [ ] User adoption metrics
- [ ] Issue rate comparison vs legacy baseline
- [ ] Feature improvement opportunities identified

## Success Criteria

### Technical
- 99.9% uptime maintained
- Zero data loss incidents
- Performance metrics meet or exceed legacy levels
- No new critical security issues

### User Experience
- Learning curve <30 minutes for power users
- New features/discoveries positive
- Legacy functionality preserved where needed
- Accessibility maintained or improved

## Escalation Procedures

- **Immediate Issues**: Rollback within 1 minute using USE_LEGACY flag
- **Performance Issues**: Investigate with performance profiling tools
- **User Resistance**: Provide targeted training sessions
- **Critical Bugs**: Rollback to legacy dashboard within 5 minutes

## Post-Cutover Sign-Off

### Operations Team Sign-Off
- [ ] All monitoring systems green for 24 hours
- [ ] Zero critical issues reported
- [ ] Performance metrics documented and signed off
- [ ] Rollback procedures tested and verified

### Development Team Sign-Off
- [ ] Code cleanup completed and verified
- [ ] Documentation updated
- [ ] All cutover checklists completed
- [ ] Post-cutover support plan established
