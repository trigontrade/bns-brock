/* eslint-disable @typescript-eslint/no-explicit-any */
/* eslint-disable @typescript-eslint/ban-ts-comment */
import React, { useState, useEffect } from 'react';
import './app.css';
import { ethers } from 'ethers';
import contractABI from './utils/contractABI.json';
import twitterLogo from './assets/twitter-logo.svg';
import { networks } from './utils/networks';

import { useWeb3React } from '@web3-react/core';

import RecentlyMinted from './components/RecentlyMinted';
import ConnectionStatus from './components/ConnectionStatus';
import ConnectButton from './components/ConnectButton';
import Avatar from './components/Avatar';

const tld = '.brock';

// Constants
const TWITTER_HANDLE = '_buildspace';
const TWITTER_LINK = `https://twitter.com/${TWITTER_HANDLE}`;
const CONTRACT_ADDRESS = '0x30bCD58beba88576B3b57ff9df4C9394baf66852';
const REVERSE_ADDRESS = '0x59E2917C7413d5EB30596AE5FaDDF7CD9921540f';

export type Record = {
  avatar: string;
  twitterTag: string;
  website: string;
  email: string;
  description: string;
  address: string;
};

export enum RecordType {
  AVATAR = 0,
  TWITTER = 1,
  WEBSITE = 2,
  EMAIL = 3,
  DESCRIPTION = 4
}

const App = () => {
  const { activate, active, account, library, chainId } = useWeb3React();
  const [domain, setDomain] = useState('');
  const [mintPrice, setMintPrice] = useState(0);

  const [records, setRecords] = useState<Record | undefined>(undefined);

  const [loading, setLoading] = useState(false);
  const [mints, setMints] = useState<Array<any>>([]);

  useEffect(() => {
    //@ts-ignore
    if (networks[chainId?.toString(16)] === 'Bitrock Mainnet') {
      fetchMints();
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [account, chainId]);

  const setReverse = async () => {
    if (!records || !domain || !active) {
      return;
    }

    try {
      const signer = library.getSigner();
      const contract = new ethers.Contract(REVERSE_ADDRESS, contractABI.reverseAbi, signer);
      const tx = await contract.setReverse(domain);
      await tx.wait();
    } catch (error) {
      console.log(error);
    }
  };

  const switchNetwork = async () => {
    if (account) {
      try {
        // Try to switch to the Bitrock Mainnet
        await library.send(
          'wallet_switchEthereumChain',
          [{ chainId: '0x1c03' }] // Check networks.js for hexadecimal network ids
        );
      } catch (error: any) {
        console.log(error);
        // This error code means that the chain we want has not been added to MetaMask
        // In this case we ask the user to add it to their MetaMask
        if (error.code === 4902) {
          try {
            await library.send('wallet_addEthereumChain', [
              {
                chainId: "0x1c03",
                  chainName: "Bitrock Mainnet",
                  rpcUrls: ["https://connect.bit-rock.io"],
                  nativeCurrency: {
                    name: "Bitrock",
                    symbol: "BROCK",
                    decimals: 18,
                },
                blockExplorerUrls: ['https://explorer.bit-rock.io/']
              }
            ]);
          } catch (error) {
            console.log(error);
          }
        }
        console.log(error);
      }
    }
  };

  const updateDomain = async () => {
    if (!records || !domain) {
      return;
    }
    setLoading(true);
    try {
      if (active) {
        const signer = library.getSigner();
        const contract = new ethers.Contract(CONTRACT_ADDRESS, contractABI.abi, signer);

        const tx = await contract['setRecords'](
          domain,
          records.avatar,
          records.twitterTag,
          records.website,
          records.email,
          records.description
        );
        await tx.wait();
        console.log('Record set https://explorer.bit-rock.io/tx/' + tx.hash);

        fetchMints();
        setRecords(undefined);
        setDomain('');
      }
    } catch (error) {
      console.log(error);
    }
    setLoading(false);
  };

  const fetchMints = async () => {
    try {
      if (active) {
        const signer = library.getSigner();
        const contract = new ethers.Contract(CONTRACT_ADDRESS, contractABI.abi, signer);

        // Get all the domain names from our contract
        const names = await contract['getAllNames']();

        // For each name, get the record and the address
        const mintRecords = await Promise.all(
          names.map(async (name: string) => {
            const mintRecord = await contract['getRecord'](name, 4);
            const owner = await contract['getAddress'](name);
            return {
              id: names.indexOf(name) + 1,
              name: name,
              record: mintRecord,
              owner: owner
            };
          })
        );

        console.log('MINTS FETCHED ', mintRecords);
        setMints(mintRecords);
      }
    } catch (error) {
      console.log(error);
    }
  };

  const mintDomain = async () => {
    // Don't run if the domain is empty
    if (!domain) {
      return;
    }

    // Alert the user if the domain is too short
    if (domain.length < 3) {
      alert('Domain must be at least 3 characters long');
      return;
    }
    // Calculate price based on length of domain (change this to match your contract)
    // 3 chars = 0.5 MATIC, 4 chars = 0.3 MATIC, 5 or more = 0.1 MATIC
    const price = domain.length === 3 ? '0.5' : domain.length === 4 ? '0.3' : '0.1';
    console.log('Minting domain', domain, 'with price', price);
    try {
      if (active) {
        const signer = library.getSigner();
        const contract = new ethers.Contract(CONTRACT_ADDRESS, contractABI.abi, signer);

        console.log('Going to pop wallet now to pay gas...');
        const tx = await contract['register'](domain, {
          value: ethers.utils.parseEther(price)
        });
        // Wait for the transaction to be mined
        const receipt = await tx.wait();

        // Check if the transaction was successfully completed
        if (receipt.status === 1) {
          console.log('Domain minted! https://explorer.bit-rock.io/tx/' + tx.hash);

          setTimeout(() => {
            fetchMints();
          }, 2000);

          setRecords(undefined);
          setDomain('');
        } else {
          alert('Transaction failed! Please try again');
        }
      }
    } catch (error) {
      console.log(error);
    }
  };

  const searchDomain = async (_domain = domain) => {
    if (!_domain) {
      return;
    }

    if (_domain.length < 3 || _domain.length > 12) return;

    const signer = library.getSigner();
    const contract = new ethers.Contract(CONTRACT_ADDRESS, contractABI.abi, signer);

    contract['getId'](_domain)
      .then(async () => {
        const res = await contract['getRecords'](_domain);
        const newRecords: Record = {
          avatar: res[0][RecordType.AVATAR],
          twitterTag: res[0][RecordType.TWITTER],
          description: res[0][RecordType.DESCRIPTION],
          email: res[0][RecordType.EMAIL],
          website: res[0][RecordType.WEBSITE],
          address: res[1]
        };

        setRecords(newRecords);
        console.log('NEW RECORDS SETT');
      })
      .catch(() => {
        switch (_domain.length) {
          case 3:
            setMintPrice(0.5);
            break;
          case 4:
            setMintPrice(0.3);
            break;
          default:
            setMintPrice(0.1);
            break;
        }
      });
  };

  const renderInputForm = () => {
    //@ts-ignore
    if (networks[chainId?.toString(16)] !== 'Bitrock Mainnet') {
      return (
        <div className="connect-wallet-container">
          <h2>Please switch to Bitrock Mainnet</h2>
          {/* This button will call our switch network function */}
          <button className="cta-button mint-button" onClick={switchNetwork}>
            Click here to switch
          </button>
        </div>
      );
    }

    return (
      <div className="form-container">
        <div className="first-row">
          <input
            type="text"
            value={domain}
            placeholder="domain"
            onChange={e => {
              setRecords(undefined);
              setMintPrice(0);
              setDomain(e.target.value);
            }}
          />
          <p className="tld"> {tld} </p>
        </div>

        {records && (
          <>
            <span id="addr" className="record">
              <input
                type="text"
                value={records.address}
                placeholder="whats ur ninja power"
                readOnly={true}
                className="readonly"
              />
            </span>
            <span id="desc" className="record">
              <input
                type="text"
                value={records.description}
                placeholder="whats ur ninja power"
                onChange={e => setRecords({ ...records, description: e.target.value })}
                readOnly={account?.toLowerCase() !== records.address.toLowerCase()}
                className={account?.toLowerCase() !== records.address.toLowerCase() ? 'readonly' : ''}
              />
            </span>
            <span id="email" className="record">
              <input
                type="text"
                value={records.email}
                placeholder="whats ur ninja power"
                onChange={e => setRecords({ ...records, email: e.target.value })}
                readOnly={account?.toLowerCase() !== records.address.toLowerCase()}
                className={account?.toLowerCase() !== records.address.toLowerCase() ? 'readonly' : ''}
              />
            </span>
            <span id="website" className="record">
              <input
                type="text"
                value={records.website}
                placeholder="whats ur ninja power"
                onChange={e => setRecords({ ...records, website: e.target.value })}
                readOnly={account?.toLowerCase() !== records.address.toLowerCase()}
                className={account?.toLowerCase() !== records.address.toLowerCase() ? 'readonly' : ''}
              />
            </span>
            <span id="twitter" className="record">
              <input
                type="text"
                value={records.twitterTag}
                placeholder="whats ur ninja power"
                onChange={e => setRecords({ ...records, twitterTag: e.target.value })}
                readOnly={account?.toLowerCase() !== records.address.toLowerCase()}
                className={account?.toLowerCase() !== records.address.toLowerCase() ? 'readonly' : ''}
              />
            </span>
            <span id="avatar" className="record">
              <input
                type="text"
                value={records.avatar}
                placeholder="whats ur ninja power"
                onChange={e => setRecords({ ...records, avatar: e.target.value })}
                readOnly={account?.toLowerCase() !== records.address.toLowerCase()}
                className={account?.toLowerCase() !== records.address.toLowerCase() ? 'readonly' : ''}
              />
            </span>
            <Avatar domain={domain} url={records.avatar} />
          </>
        )}
        <div className="button-container">
          <button
            className="cta-button mint-button"
            disabled={loading}
            onClick={() => {
              searchDomain();
            }}
          >
            Search
          </button>
          {records ? (
            <>
              <button className="cta-button mint-button" disabled={loading} onClick={updateDomain}>
                Update
              </button>
              <button className="cta-button mint-button" disabled={loading} onClick={setReverse}>
                Set Reverse
              </button>
            </>
          ) : (
            mintPrice > 0 && (
              <button className="cta-button mint-button" disabled={loading} onClick={mintDomain}>
                Mint for {mintPrice} $MATIC
              </button>
            )
          )}
        </div>
      </div>
    );
  };

  return (
    <div className="App">
      <div className="container">
        <div className="header-container">
          <header>
            <div className="left">
              <p className="title">Brock Name Service</p>
              <p className="subtitle">Your immortal API on the Bitrock Mainnet!</p>
            </div>
            <ConnectionStatus />
          </header>
        </div>

        {active ? renderInputForm() : <ConnectButton />}
        {/*mints && renderMints()*/}
        <RecentlyMinted
          mints={mints}
          onEdit={(name: string) => {
            setDomain(name);
            searchDomain(name);
          }}
        />

        <div className="footer-container">
          <img alt="Twitter Logo" className="twitter-logo" src={twitterLogo} />
          <a
            className="footer-text"
            href={TWITTER_LINK}
            target="_blank"
            rel="noreferrer"
          >{`built with @${TWITTER_HANDLE}`}</a>
        </div>
      </div>
    </div>
  );
};

export default App;
