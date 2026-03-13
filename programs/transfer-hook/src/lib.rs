use anchor_lang::prelude::*;

declare_id!("8opHzTAnfzRpPEx21XtnrVTX28YQuCpAjcn1PczScKh");

#[program]
pub mod transfer_hook {
    use super::*;

    pub fn initialize(ctx: Context<Initialize>, params: HookInitializeParams) -> Result<()> {
        require!(
            params.label.len() <= HookConfig::MAX_LABEL_LEN,
            HookError::LabelTooLong
        );

        let config = &mut ctx.accounts.config;
        config.bump = ctx.bumps.config;
        config.mint = ctx.accounts.mint.key();
        config.authority = ctx.accounts.authority.key();
        config.label = params.label;
        config.enforce_blacklist = params.enforce_blacklist;

        Ok(())
    }

    pub fn set_enforcement(ctx: Context<SetEnforcement>, enforce_blacklist: bool) -> Result<()> {
        let config = &mut ctx.accounts.config;
        require_keys_eq!(
            ctx.accounts.authority.key(),
            config.authority,
            HookError::Unauthorized
        );
        config.enforce_blacklist = enforce_blacklist;
        Ok(())
    }

    pub fn add_to_blacklist(ctx: Context<AddToBlacklist>, reason: String) -> Result<()> {
        validate_reason(&reason, HookBlacklistEntry::MAX_REASON_LEN)?;

        let config = &ctx.accounts.config;
        require_keys_eq!(
            ctx.accounts.authority.key(),
            config.authority,
            HookError::Unauthorized
        );

        let entry = &mut ctx.accounts.blacklist_entry;
        entry.bump = ctx.bumps.blacklist_entry;
        entry.config = config.key();
        entry.wallet = ctx.accounts.wallet.key();
        entry.reason = reason;

        Ok(())
    }

    pub fn remove_from_blacklist(ctx: Context<RemoveFromBlacklist>) -> Result<()> {
        let config = &ctx.accounts.config;
        require_keys_eq!(
            ctx.accounts.authority.key(),
            config.authority,
            HookError::Unauthorized
        );
        Ok(())
    }

    pub fn validate_transfer(ctx: Context<ValidateTransfer>, _amount: u64) -> Result<()> {
        validate_blacklist_guard(
            ctx.accounts.config.enforce_blacklist,
            ctx.accounts.source_owner.key(),
            ctx.accounts.destination_owner.key(),
            ctx.accounts.source_blacklist.as_ref().map(|entry| &**entry),
            ctx.accounts
                .destination_blacklist
                .as_ref()
                .map(|entry| &**entry),
        )
    }
}

#[derive(AnchorSerialize, AnchorDeserialize, Clone, Debug)]
pub struct HookInitializeParams {
    pub label: String,
    pub enforce_blacklist: bool,
}

fn validate_reason(reason: &str, max_len: usize) -> Result<()> {
    require!(
        !reason.is_empty() && reason.len() <= max_len,
        HookError::ReasonTooLong
    );
    Ok(())
}

fn validate_blacklist_guard(
    enforce_blacklist: bool,
    source_owner: Pubkey,
    destination_owner: Pubkey,
    source_blacklist: Option<&HookBlacklistEntry>,
    destination_blacklist: Option<&HookBlacklistEntry>,
) -> Result<()> {
    if !enforce_blacklist {
        return Ok(());
    }

    if let Some(entry) = source_blacklist {
        require_keys_eq!(entry.wallet, source_owner, HookError::BlacklistMismatch);
        return err!(HookError::SourceBlacklisted);
    }

    if let Some(entry) = destination_blacklist {
        require_keys_eq!(
            entry.wallet,
            destination_owner,
            HookError::BlacklistMismatch
        );
        return err!(HookError::DestinationBlacklisted);
    }

    Ok(())
}

#[account]
pub struct HookConfig {
    pub bump: u8,
    pub mint: Pubkey,
    pub authority: Pubkey,
    pub label: String,
    pub enforce_blacklist: bool,
}

impl HookConfig {
    pub const MAX_LABEL_LEN: usize = 32;
    pub const INIT_SPACE: usize = 1 + 32 + 32 + (4 + Self::MAX_LABEL_LEN) + 1;
}

#[account]
pub struct HookBlacklistEntry {
    pub bump: u8,
    pub config: Pubkey,
    pub wallet: Pubkey,
    pub reason: String,
}

impl HookBlacklistEntry {
    pub const MAX_REASON_LEN: usize = 96;
    pub const INIT_SPACE: usize = 1 + 32 + 32 + (4 + Self::MAX_REASON_LEN);
}

#[derive(Accounts)]
#[instruction(params: HookInitializeParams)]
pub struct Initialize<'info> {
    #[account(mut)]
    pub payer: Signer<'info>,
    pub authority: Signer<'info>,
    /// CHECK: the hook config is tied to a mint public key; the mint is validated by the caller flow.
    pub mint: UncheckedAccount<'info>,
    #[account(
        init,
        payer = payer,
        space = 8 + HookConfig::INIT_SPACE,
        seeds = [b"hook-config", mint.key().as_ref()],
        bump
    )]
    pub config: Account<'info, HookConfig>,
    pub system_program: Program<'info, System>,
}

#[derive(Accounts)]
pub struct SetEnforcement<'info> {
    pub authority: Signer<'info>,
    #[account(mut, seeds = [b"hook-config", config.mint.as_ref()], bump = config.bump)]
    pub config: Account<'info, HookConfig>,
}

#[derive(Accounts)]
pub struct AddToBlacklist<'info> {
    #[account(mut)]
    pub payer: Signer<'info>,
    pub authority: Signer<'info>,
    #[account(seeds = [b"hook-config", config.mint.as_ref()], bump = config.bump)]
    pub config: Account<'info, HookConfig>,
    /// CHECK: only the public key is used in PDA derivation.
    pub wallet: UncheckedAccount<'info>,
    #[account(
        init_if_needed,
        payer = payer,
        space = 8 + HookBlacklistEntry::INIT_SPACE,
        seeds = [b"hook-blacklist", config.key().as_ref(), wallet.key().as_ref()],
        bump
    )]
    pub blacklist_entry: Account<'info, HookBlacklistEntry>,
    pub system_program: Program<'info, System>,
}

#[derive(Accounts)]
pub struct RemoveFromBlacklist<'info> {
    pub authority: Signer<'info>,
    #[account(seeds = [b"hook-config", config.mint.as_ref()], bump = config.bump)]
    pub config: Account<'info, HookConfig>,
    /// CHECK: receives reclaimed rent from the closed PDA.
    #[account(mut)]
    pub receiver: UncheckedAccount<'info>,
    #[account(
        mut,
        close = receiver,
        seeds = [b"hook-blacklist", config.key().as_ref(), blacklist_entry.wallet.as_ref()],
        bump = blacklist_entry.bump
    )]
    pub blacklist_entry: Account<'info, HookBlacklistEntry>,
}

#[derive(Accounts)]
pub struct ValidateTransfer<'info> {
    #[account(seeds = [b"hook-config", config.mint.as_ref()], bump = config.bump)]
    pub config: Account<'info, HookConfig>,
    /// CHECK: used only for address comparison.
    pub source_owner: UncheckedAccount<'info>,
    /// CHECK: used only for address comparison.
    pub destination_owner: UncheckedAccount<'info>,
    pub source_blacklist: Option<Account<'info, HookBlacklistEntry>>,
    pub destination_blacklist: Option<Account<'info, HookBlacklistEntry>>,
}

#[error_code]
pub enum HookError {
    #[msg("Only the configured authority may perform this action.")]
    Unauthorized,
    #[msg("The hook label is too long.")]
    LabelTooLong,
    #[msg("The blacklist reason is invalid.")]
    ReasonTooLong,
    #[msg("The source owner is blacklisted.")]
    SourceBlacklisted,
    #[msg("The destination owner is blacklisted.")]
    DestinationBlacklisted,
    #[msg("The blacklist entry does not match the provided account.")]
    BlacklistMismatch,
}

#[cfg(test)]
mod tests {
    use super::*;

    fn blacklist_entry(wallet: Pubkey) -> HookBlacklistEntry {
        HookBlacklistEntry {
            bump: 1,
            config: Pubkey::new_unique(),
            wallet,
            reason: "watchlist".to_string(),
        }
    }

    #[test]
    fn reason_validation_rejects_invalid_values() {
        assert!(validate_reason("", HookBlacklistEntry::MAX_REASON_LEN).is_err());
        assert!(validate_reason("sanctions", HookBlacklistEntry::MAX_REASON_LEN).is_ok());
        let long_reason = "x".repeat(HookBlacklistEntry::MAX_REASON_LEN + 1);
        assert!(validate_reason(&long_reason, HookBlacklistEntry::MAX_REASON_LEN).is_err());
    }

    #[test]
    fn blacklist_guard_allows_transfers_when_disabled() {
        let source = Pubkey::new_unique();
        let destination = Pubkey::new_unique();
        let entry = blacklist_entry(source);

        assert!(validate_blacklist_guard(false, source, destination, Some(&entry), None).is_ok());
    }

    #[test]
    fn blacklist_guard_blocks_blacklisted_source() {
        let source = Pubkey::new_unique();
        let destination = Pubkey::new_unique();
        let entry = blacklist_entry(source);

        assert!(validate_blacklist_guard(true, source, destination, Some(&entry), None).is_err());
    }

    #[test]
    fn blacklist_guard_blocks_blacklisted_destination() {
        let source = Pubkey::new_unique();
        let destination = Pubkey::new_unique();
        let entry = blacklist_entry(destination);

        assert!(validate_blacklist_guard(true, source, destination, None, Some(&entry)).is_err());
    }

    #[test]
    fn blacklist_guard_rejects_mismatched_entry() {
        let source = Pubkey::new_unique();
        let destination = Pubkey::new_unique();
        let entry = blacklist_entry(Pubkey::new_unique());

        assert!(validate_blacklist_guard(true, source, destination, Some(&entry), None).is_err());
    }
}
