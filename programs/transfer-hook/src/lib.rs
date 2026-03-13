use anchor_lang::{
    prelude::*,
    solana_program::{program::invoke_signed, system_instruction},
};
use spl_tlv_account_resolution::{
    account::ExtraAccountMeta, seeds::Seed, state::ExtraAccountMetaList,
};
use spl_transfer_hook_interface::{
    get_extra_account_metas_address, get_extra_account_metas_address_and_bump_seed,
    instruction::{ExecuteInstruction, TransferHookInstruction},
};
use std::str::FromStr;

declare_id!("4eY1C8wjyJXTA3zUju9tKmND1netsJw9ViW7uBRCdzGQ");

const TOKEN_ACCOUNT_OWNER_OFFSET: usize = 32;
const TOKEN_ACCOUNT_OWNER_LEN: usize = 32;
const EXECUTE_EXTRA_META_COUNT: usize = 3;
const STABLECOIN_CORE_PROGRAM_ID: &str = "DNU6Zz4eBYdh5gMGppGrGXMjA3atST2dSsiX6XZCF7v1";

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

        initialize_extra_account_meta_list_account(
            &ctx.accounts.payer.to_account_info(),
            &ctx.accounts.mint.to_account_info(),
            &ctx.accounts.extra_account_meta_list.to_account_info(),
            &ctx.accounts.system_program.to_account_info(),
        )?;

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

    #[interface(spl_transfer_hook_interface::execute)]
    pub fn execute(ctx: Context<ExecuteTransferHook>, amount: u64) -> Result<()> {
        let extra_meta_address =
            get_extra_account_metas_address(&ctx.accounts.mint.key(), &crate::ID);
        require_keys_eq!(
            ctx.accounts.extra_account_meta_list.key(),
            extra_meta_address,
            HookError::InvalidExtraAccountMetaList
        );

        let extra_meta_data = ctx.accounts.extra_account_meta_list.try_borrow_data()?;
        ExtraAccountMetaList::check_account_infos::<ExecuteInstruction>(
            &ctx.accounts.to_account_infos(),
            &TransferHookInstruction::Execute { amount }.pack(),
            &ctx.program_id,
            &extra_meta_data,
        )?;

        let source_owner =
            owner_from_token_account(&ctx.accounts.source_account.to_account_info())?;
        let destination_owner =
            owner_from_token_account(&ctx.accounts.destination_account.to_account_info())?;
        let stablecoin_config = stablecoin_config_for_mint(&ctx.accounts.mint.key())?;
        let source_blacklist =
            blacklist_entry_from_account(&ctx.accounts.source_blacklist.to_account_info())?;
        let destination_blacklist =
            blacklist_entry_from_account(&ctx.accounts.destination_blacklist.to_account_info())?;

        validate_blacklist_guard(
            ctx.accounts.config.enforce_blacklist,
            ctx.accounts.config.key(),
            ctx.accounts.source_owner.key(),
            stablecoin_config,
            source_owner,
            destination_owner,
            source_blacklist.as_ref(),
            destination_blacklist.as_ref(),
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
    config_key: Pubkey,
    transfer_authority: Pubkey,
    stablecoin_config: Pubkey,
    source_owner: Pubkey,
    destination_owner: Pubkey,
    source_blacklist: Option<&HookBlacklistEntry>,
    destination_blacklist: Option<&HookBlacklistEntry>,
) -> Result<()> {
    if !enforce_blacklist {
        return Ok(());
    }

    if let Some(entry) = source_blacklist {
        require_keys_eq!(entry.config, config_key, HookError::BlacklistMismatch);
        require_keys_eq!(entry.wallet, source_owner, HookError::BlacklistMismatch);
        if transfer_authority != stablecoin_config {
            return err!(HookError::SourceBlacklisted);
        }
    }

    if let Some(entry) = destination_blacklist {
        require_keys_eq!(entry.config, config_key, HookError::BlacklistMismatch);
        require_keys_eq!(
            entry.wallet,
            destination_owner,
            HookError::BlacklistMismatch
        );
        return err!(HookError::DestinationBlacklisted);
    }

    Ok(())
}

fn stablecoin_config_for_mint(mint: &Pubkey) -> Result<Pubkey> {
    let stablecoin_program = Pubkey::from_str(STABLECOIN_CORE_PROGRAM_ID)
        .map_err(|_| error!(HookError::InvalidStablecoinProgram))?;
    Ok(Pubkey::find_program_address(&[b"config", mint.as_ref()], &stablecoin_program).0)
}

fn initialize_extra_account_meta_list_account<'info>(
    payer: &AccountInfo<'info>,
    mint: &AccountInfo<'info>,
    extra_account_meta_list: &AccountInfo<'info>,
    system_program: &AccountInfo<'info>,
) -> Result<()> {
    let (expected_address, bump) =
        get_extra_account_metas_address_and_bump_seed(mint.key, &crate::ID);
    require_keys_eq!(
        extra_account_meta_list.key(),
        expected_address,
        HookError::InvalidExtraAccountMetaList
    );
    require!(
        extra_account_meta_list.lamports() == 0,
        HookError::ExtraAccountMetaListAlreadyInitialized
    );

    let account_size = ExtraAccountMetaList::size_of(EXECUTE_EXTRA_META_COUNT)?;
    let lamports = Rent::get()?.minimum_balance(account_size);
    let bump_seed = [bump];
    let signer_seeds = &[&[
        b"extra-account-metas".as_ref(),
        mint.key.as_ref(),
        bump_seed.as_ref(),
    ][..]];

    invoke_signed(
        &system_instruction::create_account(
            payer.key,
            extra_account_meta_list.key,
            lamports,
            account_size as u64,
            &crate::ID,
        ),
        &[
            payer.clone(),
            extra_account_meta_list.clone(),
            system_program.clone(),
        ],
        signer_seeds,
    )?;

    let metas = required_execute_account_metas()?;
    let mut extra_meta_data = extra_account_meta_list.try_borrow_mut_data()?;
    ExtraAccountMetaList::init::<ExecuteInstruction>(&mut extra_meta_data, &metas)?;

    Ok(())
}

fn required_execute_account_metas() -> Result<Vec<ExtraAccountMeta>> {
    Ok(vec![
        ExtraAccountMeta::new_with_seeds(
            &[
                Seed::Literal {
                    bytes: b"hook-config".to_vec(),
                },
                Seed::AccountKey { index: 1 },
            ],
            false,
            false,
        )?,
        ExtraAccountMeta::new_with_seeds(
            &[
                Seed::Literal {
                    bytes: b"hook-blacklist".to_vec(),
                },
                Seed::AccountKey { index: 5 },
                Seed::AccountData {
                    account_index: 0,
                    data_index: TOKEN_ACCOUNT_OWNER_OFFSET as u8,
                    length: TOKEN_ACCOUNT_OWNER_LEN as u8,
                },
            ],
            false,
            false,
        )?,
        ExtraAccountMeta::new_with_seeds(
            &[
                Seed::Literal {
                    bytes: b"hook-blacklist".to_vec(),
                },
                Seed::AccountKey { index: 5 },
                Seed::AccountData {
                    account_index: 2,
                    data_index: TOKEN_ACCOUNT_OWNER_OFFSET as u8,
                    length: TOKEN_ACCOUNT_OWNER_LEN as u8,
                },
            ],
            false,
            false,
        )?,
    ])
}

fn owner_from_token_account(account: &AccountInfo<'_>) -> Result<Pubkey> {
    let data = account.try_borrow_data()?;
    require!(
        data.len() >= TOKEN_ACCOUNT_OWNER_OFFSET + TOKEN_ACCOUNT_OWNER_LEN,
        HookError::InvalidTokenAccount
    );
    let owner_bytes: [u8; 32] = data
        [TOKEN_ACCOUNT_OWNER_OFFSET..TOKEN_ACCOUNT_OWNER_OFFSET + TOKEN_ACCOUNT_OWNER_LEN]
        .try_into()
        .map_err(|_| error!(HookError::InvalidTokenAccount))?;
    Ok(Pubkey::new_from_array(owner_bytes))
}

fn blacklist_entry_from_account(account: &AccountInfo<'_>) -> Result<Option<HookBlacklistEntry>> {
    if account.lamports() == 0 || account.data_is_empty() {
        return Ok(None);
    }

    let data = account.try_borrow_data()?;
    if data.len() < 8 {
        return Ok(None);
    }
    let mut slice: &[u8] = &data;
    HookBlacklistEntry::try_deserialize(&mut slice).map(Some)
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
    /// CHECK: PDA holding SPL transfer-hook extra account meta configuration.
    #[account(mut)]
    pub extra_account_meta_list: UncheckedAccount<'info>,
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
pub struct ExecuteTransferHook<'info> {
    /// CHECK: Token-2022 source token account; owner is parsed from raw account data.
    pub source_account: UncheckedAccount<'info>,
    /// CHECK: Token-2022 mint account.
    pub mint: UncheckedAccount<'info>,
    /// CHECK: Token-2022 destination token account; owner is parsed from raw account data.
    pub destination_account: UncheckedAccount<'info>,
    /// CHECK: transfer authority or delegate supplied by Token-2022.
    pub source_owner: UncheckedAccount<'info>,
    /// CHECK: SPL transfer-hook validation PDA account.
    pub extra_account_meta_list: UncheckedAccount<'info>,
    #[account(seeds = [b"hook-config", config.mint.as_ref()], bump = config.bump)]
    pub config: Account<'info, HookConfig>,
    /// CHECK: blacklist PDA may be absent; data is deserialized manually when present.
    pub source_blacklist: UncheckedAccount<'info>,
    /// CHECK: blacklist PDA may be absent; data is deserialized manually when present.
    pub destination_blacklist: UncheckedAccount<'info>,
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
    #[msg("The transfer-hook extra account meta list PDA is invalid.")]
    InvalidExtraAccountMetaList,
    #[msg("The transfer-hook extra account meta list PDA is already initialized.")]
    ExtraAccountMetaListAlreadyInitialized,
    #[msg("The provided token account data is invalid.")]
    InvalidTokenAccount,
    #[msg("The stablecoin core program id is invalid.")]
    InvalidStablecoinProgram,
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
        let config = Pubkey::new_unique();
        let entry = blacklist_entry(source);
        let transfer_authority = Pubkey::new_unique();
        let stablecoin_config = Pubkey::new_unique();

        assert!(validate_blacklist_guard(
            false,
            config,
            transfer_authority,
            stablecoin_config,
            source,
            destination,
            Some(&entry),
            None
        )
        .is_ok());
    }

    #[test]
    fn blacklist_guard_blocks_blacklisted_source() {
        let source = Pubkey::new_unique();
        let destination = Pubkey::new_unique();
        let config = Pubkey::new_unique();
        let entry = blacklist_entry(source);
        let source_entry = HookBlacklistEntry { config, ..entry };
        let transfer_authority = Pubkey::new_unique();
        let stablecoin_config = Pubkey::new_unique();

        assert!(validate_blacklist_guard(
            true,
            config,
            transfer_authority,
            stablecoin_config,
            source,
            destination,
            Some(&source_entry),
            None
        )
        .is_err());
    }

    #[test]
    fn blacklist_guard_blocks_blacklisted_destination() {
        let source = Pubkey::new_unique();
        let destination = Pubkey::new_unique();
        let config = Pubkey::new_unique();
        let entry = blacklist_entry(destination);
        let destination_entry = HookBlacklistEntry { config, ..entry };
        let transfer_authority = Pubkey::new_unique();
        let stablecoin_config = Pubkey::new_unique();

        assert!(validate_blacklist_guard(
            true,
            config,
            transfer_authority,
            stablecoin_config,
            source,
            destination,
            None,
            Some(&destination_entry)
        )
        .is_err());
    }

    #[test]
    fn blacklist_guard_rejects_mismatched_entry() {
        let source = Pubkey::new_unique();
        let destination = Pubkey::new_unique();
        let config = Pubkey::new_unique();
        let entry = blacklist_entry(Pubkey::new_unique());
        let transfer_authority = Pubkey::new_unique();
        let stablecoin_config = Pubkey::new_unique();

        assert!(validate_blacklist_guard(
            true,
            config,
            transfer_authority,
            stablecoin_config,
            source,
            destination,
            Some(&entry),
            None
        )
        .is_err());
    }

    #[test]
    fn blacklist_guard_allows_admin_seizure_from_blacklisted_source() {
        let source = Pubkey::new_unique();
        let destination = Pubkey::new_unique();
        let config = Pubkey::new_unique();
        let stablecoin_config = Pubkey::new_unique();
        let source_entry = HookBlacklistEntry {
            config,
            ..blacklist_entry(source)
        };

        assert!(validate_blacklist_guard(
            true,
            config,
            stablecoin_config,
            stablecoin_config,
            source,
            destination,
            Some(&source_entry),
            None
        )
        .is_ok());
    }

    #[test]
    fn required_execute_metas_match_expected_count() {
        let metas = required_execute_account_metas().unwrap();
        assert_eq!(metas.len(), EXECUTE_EXTRA_META_COUNT);
    }
}
